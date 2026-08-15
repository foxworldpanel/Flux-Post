import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import 'dotenv/config';

const execAsync = promisify(exec);

const supabaseUrl = process.env.SUPABASE_URL;
const workerSecret = process.env.RENDER_WORKER_SECRET;

if (!supabaseUrl || !workerSecret) {
  console.error('ERROR: Missing SUPABASE_URL or RENDER_WORKER_SECRET');
  process.exit(1);
}

const BRIDGE_URL = `${supabaseUrl}/functions/v1/render-bridge`;

const client = axios.create({
  baseURL: BRIDGE_URL,
  headers: {
    'x-render-worker-secret': workerSecret,
    'Content-Type': 'application/json'
  }
});

async function claimJob() {
  try {
    const { data } = await client.post('', { action: 'claim' });
    if (data && data.job === null) {
      // Bridge explicitly returned no job available.
      return null;
    }
    return data;
  } catch (error) {
    const errorData = error.response?.data;
    // Log real errors (e.g., 401, 500), but stay quiet on 404/Empty if needed
    console.error('Error claiming job:', errorData || error.message);
    return null;
  }
}

async function startHeartbeat(jobId) {
  return setInterval(async () => {
    try {
      await client.post('', { action: 'heartbeat', job_id: jobId });
    } catch (error) {
      console.error(`[${jobId}] Heartbeat failed:`, error.response?.data || error.message);
    }
  }, 60000);
}

async function processJob(claimResult) {
  const { job, inputs } = claimResult;
  const workDir = await fs.mkdtemp(path.join(tmpdir(), `render-${job.id}-`));
  const heartbeat = await startHeartbeat(job.id);
  console.log(`[${job.id}] Starting process (Attempt ${job.attempts})`);

  try {
    const videoPath = path.join(workDir, 'input_video.mp4');
    const musicPath = path.join(workDir, 'input_music.mp3');
    const outputPath = path.join(workDir, 'output.mp4');

    // 1. Download via Signed URLs
    console.log(`[${job.id}] Downloading assets...`);
    const [vRes, mRes] = await Promise.all([
      axios.get(inputs.video_url, { responseType: 'arraybuffer' }),
      axios.get(inputs.music_url, { responseType: 'arraybuffer' })
    ]);
    await fs.writeFile(videoPath, Buffer.from(vRes.data));
    await fs.writeFile(musicPath, Buffer.from(mRes.data));

    // 2. FFmpeg Processing
    console.log(`[${job.id}] Probing video for audio streams...`);
    
    let hasAudio = false;
    try {
      const { stdout } = await execAsync(
        `ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "${videoPath}"`
      );
      hasAudio = stdout.trim().length > 0;
      console.log(`[${job.id}] Video audio stream: ${hasAudio ? 'YES' : 'NO'}`);
    } catch (probeErr) {
      console.warn(`[${job.id}] ffprobe failed or no audio:`, probeErr.message);
      hasAudio = false;
    }

    console.log(`[${job.id}] Rendering (${hasAudio ? 'original audio + music' : 'music only'})...`);
    
    const musicStartSec = (job.music_start_ms || 0) / 1000;
    const musicVol = (job.music_volume || 100) / 100;
    const origVol = (job.original_audio_volume || 0) / 100;

    await new Promise((resolve, reject) => {
      const command = ffmpeg(videoPath)
        .input(musicPath)
        .inputOptions([`-ss ${musicStartSec}`]);

      if (hasAudio) {
        // Case: Video has audio, mix them
        command.complexFilter([
          `[0:a]volume=${origVol}[a0];`,
          `[1:a]volume=${musicVol}[a1];`,
          `[a0][a1]amix=inputs=2:duration=first[aout]`
        ]);
        command.outputOptions(['-map [aout]']);
      } else {
        // Case: Video is silent, use music only
        command.complexFilter([
          `[1:a]volume=${musicVol}[aout]`
        ]);
        command.outputOptions(['-map [aout]']);
      }

      command.outputOptions([
        '-map 0:v',
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-pix_fmt yuv420p',
        '-c:a aac',
        '-shortest',
        '-movflags +faststart'
      ])
      .on('error', (err, stdout, stderr) => {
        console.error(`[${job.id}] FFmpeg STDERR:`, stderr);
        reject(new Error(`FFmpeg failed: ${err.message}`));
      })
      .on('end', resolve)
      .save(outputPath);
    });

    // 3. Secure Upload via Signed Upload URL
    console.log(`[${job.id}] Requesting signed upload URL...`);
    const { data: uploadInfo } = await client.post('', {
      action: 'get_upload_url',
      job_id: job.id
    });

    if (!uploadInfo || !uploadInfo.upload_url || !uploadInfo.token) {
      throw new Error("Failed to obtain a valid signed upload URL from bridge");
    }

    console.log(`[${job.id}] Uploading result to: ${uploadInfo.upload_url.split('?')[0]}`);
    const finalBuffer = await fs.readFile(outputPath);
    
    try {
      // Supabase Storage Signed Upload Contract Audit:
      // The signed URL returned by createSignedUploadUrl is for the TUS protocol or standard S3-like PUT.
      // However, when using the signed URL directly via PUT, the 'x-upsert' header might be required if overwriting,
      // and the 'Authorization' header must be exactly what Supabase expects.
      
      const uploadResponse = await axios.put(uploadInfo.upload_url, finalBuffer, {
        headers: { 
          'Content-Type': 'video/mp4',
          'Authorization': `Bearer ${uploadInfo.token}`,
          'x-upsert': 'true'
        }
      });
      
      console.log(`[${job.id}] Upload HTTP status: ${uploadResponse.status}`);
      console.log(`[${job.id}] Upload response validated.`);
    } catch (uploadErr) {
      const errorResponse = uploadErr.response;
      const detailedError = errorResponse 
        ? `HTTP ${errorResponse.status}: ${JSON.stringify(errorResponse.data)}`
        : uploadErr.message;
      
      console.error(`[${job.id}] Upload Error Details:`, detailedError);
      throw new Error(`Upload failed: ${detailedError}`);
    }

    // 4. Verification Step: Bridge will verify object existence during 'complete' action
    console.log(`[${job.id}] Verifying stored object...`);

    const stats = await fs.stat(outputPath);
    await client.post('', { 
      action: 'complete', 
      job_id: job.id,
      file_metadata: {
        file_size: stats.size
      }
    });

    console.log(`[${job.id}] Success.`);

  } catch (err) {
    const errMsg = err.response?.data?.error || err.message;
    console.error(`[${job.id}] Failed:`, errMsg);
    await client.post('', { action: 'fail', job_id: job.id, error_message: errMsg });
  } finally {
    clearInterval(heartbeat);
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  console.log('Render Worker (Bridge Edition) operational. Polling...');
  
  process.on('SIGTERM', () => process.exit(0));
  process.on('SIGINT', () => process.exit(0));

  while (true) {
    try {
      const claimResult = await claimJob();
      if (claimResult && claimResult.job) {
        await processJob(claimResult);
      } else {
        await new Promise(r => setTimeout(r, 10000));
      }
    } catch (err) {
      console.error('Main loop error:', err.message);
      await new Promise(r => setTimeout(r, 30000));
    }
  }
}

main();
