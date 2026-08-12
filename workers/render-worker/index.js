import { createClient } from '@supabase/supabase-js';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import 'dotenv/config';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function claimJob() {
  const { data, error } = await supabase.rpc('claim_next_render_job', { lease_interval: '5 minutes' });
  if (error) {
    console.error('Error claiming job:', error);
    return null;
  }
  return data;
}

async function startHeartbeat(jobId) {
  return setInterval(async () => {
    const { error } = await supabase.rpc('heartbeat_render_job', { job_id: jobId });
    if (error) console.error(`[${jobId}] Heartbeat failed:`, error.message);
  }, 60000); // Heartbeat a cada 1 minuto
}

async function processJob(job) {
  const workDir = await fs.mkdtemp(path.join(tmpdir(), `render-${job.id}-`));
  const heartbeat = startHeartbeat(job.id);
  console.log(`[${job.id}] Starting process in ${workDir} (Attempt ${job.attempts})`);

  try {
    // 1. Get Content Metadata
    const { data: content } = await supabase.from('content_library').select('*').eq('id', job.source_content_id).single();
    const { data: music } = await supabase.from('music_tracks').select('*').eq('id', job.music_track_id).single();

    if (!content || !music) throw new Error('Input files not found in library');

    // 2. Download files
    const videoPath = path.join(workDir, 'input_video.mp4');
    const musicPath = path.join(workDir, 'input_music.mp3');
    const outputPath = path.join(workDir, 'output.mp4');

    const { data: videoData, error: vErr } = await supabase.storage.from('content-library').download(content.storage_path);
    if (vErr) throw new Error(`Video download failed: ${vErr.message}`);
    
    const { data: musicData, error: mErr } = await supabase.storage.from('music-tracks').download(music.storage_path);
    if (mErr) throw new Error(`Music download failed: ${mErr.message}`);

    await fs.writeFile(videoPath, Buffer.from(await videoData.arrayBuffer()));
    await fs.writeFile(musicPath, Buffer.from(await musicData.arrayBuffer()));

    // 3. FFmpeg Processing
    const musicStartSec = (job.music_start_ms || 0) / 1000;
    const musicVol = (job.music_volume || 100) / 100;
    const origVol = (job.original_audio_volume || 0) / 100;

    await new Promise((resolve, reject) => {
      // ffmpeg command: amix=inputs=2:duration=first ensures video duration controls output
      ffmpeg(videoPath)
        .input(musicPath)
        .inputOptions([`-ss ${musicStartSec}`])
        .complexFilter([
          `[0:a]volume=${origVol}[a0];`,
          `[1:a]volume=${musicVol}[a1];`,
          `[a0][a1]amix=inputs=2:duration=first[aout]`
        ])
        .outputOptions([
          '-map 0:v',
          '-map [aout]',
          '-c:v libx264',
          '-preset fast',
          '-crf 23',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-shortest',
          '-movflags +faststart'
        ])
        .on('start', (cmd) => {
           // Log partial command to avoid leaking signed URLs if they were passed (here they aren't, but safety first)
           console.log(`[${job.id}] FFmpeg started`);
        })
        .on('error', reject)
        .on('end', resolve)
        .save(outputPath);
    });

    // 4. Upload
    const renderKey = job.render_key || `render_${job.id}_${Date.now()}`;
    const storagePath = `${job.user_id}/${renderKey}.mp4`;
    const finalBuffer = await fs.readFile(outputPath);

    const { error: uploadError } = await supabase.storage.from('rendered').upload(storagePath, finalBuffer, {
      contentType: 'video/mp4',
      upsert: true
    });

    if (uploadError) throw uploadError;

    // 5. Update Job
    await supabase.from('media_renders').update({
      status: 'ready',
      storage_path: storagePath,
      completed_at: new Date().toISOString()
    }).eq('id', job.id);

    console.log(`[${job.id}] Success: ${storagePath}`);

  } catch (err) {
    console.error(`[${job.id}] Failed:`, err.message);
    // Persist error but respect max_attempts (handled by RPC in next cycle if stuck, or here for immediate fail)
    await supabase.from('media_renders').update({
      status: job.attempts >= job.max_attempts ? 'failed' : 'queued',
      error_message: err.message,
      last_heartbeat: null
    }).eq('id', job.id);
  } finally {
    clearInterval(heartbeat);
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  console.log('Render Worker operational. Polling queue...');
  
  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`Received ${signal}. Shutting down worker...`);
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  while (true) {
    try {
      const job = await claimJob();
      if (job) {
        await processJob(job);
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