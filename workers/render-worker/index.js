import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

const execAsync = promisify(exec);

function srtTimestamp(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const wholeSeconds = Math.floor(safe % 60);
  const milliseconds = Math.floor((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(wholeSeconds).padStart(2, '0')},${String(milliseconds).padStart(3, '0')}`;
}

function alignmentToCues(payload) {
  const alignment = payload?.normalized_alignment || payload?.alignment || payload;
  const chars = alignment?.characters;
  const starts = alignment?.character_start_times_seconds;
  const ends = alignment?.character_end_times_seconds;
  if (!Array.isArray(chars) || !Array.isArray(starts) || !Array.isArray(ends)) return [];

  const words = [];
  let text = '';
  let start = null;
  let end = null;
  for (let index = 0; index < chars.length; index += 1) {
    const character = chars[index];
    if (start === null && character.trim()) start = starts[index];
    text += character;
    end = ends[index];
    if (/\s/.test(character) && text.trim()) {
      words.push({ text: text.trim(), start: Number(start || 0), end: Number(end || start || 0) });
      text = '';
      start = null;
    }
  }
  if (text.trim()) words.push({ text: text.trim(), start: Number(start || 0), end: Number(end || start || 0) });

  const cues = [];
  for (let index = 0; index < words.length; index += 5) {
    const group = words.slice(index, index + 5);
    cues.push({
      text: group.map(word => word.text).join(' '),
      start: group[0].start,
      end: Math.max(group[group.length - 1].end, group[0].start + 0.7),
    });
  }
  return cues;
}

async function writeSubtitles(filePath, alignment) {
  const cues = alignmentToCues(alignment);
  if (!cues.length) return false;
  const content = cues.map((cue, index) =>
    `${index + 1}\n${srtTimestamp(cue.start)} --> ${srtTimestamp(cue.end)}\n${cue.text}\n`
  ).join('\n');
  await fs.writeFile(filePath, content, 'utf8');
  return true;
}

async function probeDuration(filePath) {
  const { stdout } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`
  );
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('Could not determine narration duration');
  return duration;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'no-key-provided';
const workerSecret = process.env.RENDER_WORKER_SECRET;

if (!supabaseUrl || !workerSecret) {
  console.error('ERROR: Missing SUPABASE_URL or RENDER_WORKER_SECRET');
  process.exit(1);
}

// Create a storage client for uploadToSignedUrl
// We use the anon key since we will use a signed token for the actual upload
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: { transport: WebSocket },
});

const BRIDGE_URL = `${supabaseUrl}/functions/v1/render-bridge`;

const client = axios.create({
  baseURL: BRIDGE_URL,
  headers: {
    'x-render-worker-secret': workerSecret,
    'Content-Type': 'application/json',
    'apikey': supabaseAnonKey,
    'Authorization': `Bearer ${supabaseAnonKey}`
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
    const narrationPath = path.join(workDir, 'narration.mp3');
    const subtitlePath = path.join(workDir, 'captions.srt');
    const outputPath = path.join(workDir, 'output.mp4');

    // 1. Download via Signed URLs
    console.log(`[${job.id}] Downloading assets...`);
    const [vRes, mRes, nRes] = await Promise.all([
      axios.get(inputs.video_url, { responseType: 'arraybuffer' }),
      inputs.music_url ? axios.get(inputs.music_url, { responseType: 'arraybuffer' }) : null,
      inputs.narration_url ? axios.get(inputs.narration_url, { responseType: 'arraybuffer' }) : null,
    ]);
    await fs.writeFile(videoPath, Buffer.from(vRes.data));
    if (mRes) await fs.writeFile(musicPath, Buffer.from(mRes.data));
    if (nRes) await fs.writeFile(narrationPath, Buffer.from(nRes.data));

    const isStudioJob = String(inputs.pipeline || job.render_options?.pipeline || '').startsWith('ai_studio_');
    if (isStudioJob) {
      if (!inputs.narration_url || !nRes) {
        throw new Error('Studio IA job received without narration audio');
      }
      const narrationDuration = await probeDuration(narrationPath);
      const hasSubtitles = inputs.subtitles_enabled
        ? await writeSubtitles(subtitlePath, inputs.alignment)
        : false;
      const musicVol = (job.music_volume ?? 18) / 100;
      const captionOptions = job.render_options || {};
      const allowedFonts = new Set([
        'DejaVu Sans',
        'Liberation Sans',
        'Liberation Serif',
        'DejaVu Sans Mono',
      ]);
      const subtitleFont = allowedFonts.has(captionOptions.subtitleFont)
        ? captionOptions.subtitleFont
        : 'DejaVu Sans';
      const subtitleFontSize = Math.min(36, Math.max(16, Number(captionOptions.subtitleFontSize) || 22));
      const subtitleColors = {
        white: '&H00FFFFFF',
        yellow: '&H0000FFFF',
        cyan: '&H00FFFF00',
        pink: '&H00B672F4',
      };
      const subtitleColor = subtitleColors[captionOptions.subtitleColor] || subtitleColors.white;
      const requestedSubtitlePosition = String(
        captionOptions.subtitlePosition ?? captionOptions.subtitle_position ?? 'bottom'
      ).trim().toLowerCase();
      const subtitlePositions = {
        top: { alignment: 8, margin: 85 },
        center: { alignment: 5, margin: 0 },
        bottom: { alignment: 2, margin: 110 },
      };
      const subtitlePosition = subtitlePositions[requestedSubtitlePosition] || subtitlePositions.bottom;

      console.log(
        `[${job.id}] Rendering Studio IA video (${narrationDuration.toFixed(1)}s, subtitles: ${hasSubtitles ? 'YES' : 'NO'}, position: ${requestedSubtitlePosition})...`
      );

      await new Promise((resolve, reject) => {
        const command = ffmpeg()
          .input(videoPath)
          .inputOptions(['-stream_loop -1']);

        let narrationInput = 1;
        if (mRes) {
          command.input(musicPath).inputOptions(['-stream_loop -1']);
          narrationInput = 2;
        }
        command.input(narrationPath);

        const filters = [];
        if (hasSubtitles) {
          filters.push(
            `[0:v]subtitles='${subtitlePath}':force_style='FontName=${subtitleFont},FontSize=${subtitleFontSize},Bold=1,PrimaryColour=${subtitleColor},OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=1,Alignment=${subtitlePosition.alignment},MarginV=${subtitlePosition.margin}'[vout]`
          );
        }
        filters.push(`[${narrationInput}:a]volume=1.0[narration]`);
        if (mRes) {
          filters.push(`[1:a]volume=${musicVol}[music]`);
          filters.push('[narration][music]amix=inputs=2:duration=first:dropout_transition=2[aout]');
        } else {
          filters.push('[narration]anull[aout]');
        }

        command.complexFilter(filters);
        command.outputOptions([
          hasSubtitles ? '-map [vout]' : '-map 0:v',
          '-map [aout]',
          '-c:v libx264',
          '-preset fast',
          '-crf 22',
          '-pix_fmt yuv420p',
          '-c:a aac',
          '-b:a 192k',
          `-t ${narrationDuration.toFixed(3)}`,
          '-movflags +faststart'
        ])
        .on('error', (err, stdout, stderr) => {
          console.error(`[${job.id}] Studio FFmpeg STDERR:`, stderr);
          reject(new Error(`Studio FFmpeg failed: ${err.message}`));
        })
        .on('end', resolve)
        .save(outputPath);
      });
    } else {

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
    }

    // 3. Secure Upload via Signed Upload URL
    console.log(`[${job.id}] Requesting signed upload URL...`);
    const { data: uploadInfo } = await client.post('', {
      action: 'get_upload_url',
      job_id: job.id
    });

    if (!uploadInfo || !uploadInfo.upload_url || !uploadInfo.token) {
      throw new Error("Failed to obtain a valid signed upload URL from bridge");
    }

    console.log(`[${job.id}] Uploading result to: ${uploadInfo.upload_url.split('?')[0]} (Path: ${uploadInfo.storage_path})`);
    const finalBuffer = await fs.readFile(outputPath);
    
    try {
      console.log(`[${job.id}] Uploading via Supabase signed upload...`);
      
      const { data: uploadResult, error: uploadError } = await supabase.storage
        .from('rendered')
        .uploadToSignedUrl(
          uploadInfo.storage_path,
          uploadInfo.token,
          finalBuffer,
          {
            contentType: 'video/mp4',
            upsert: true
          }
        );
      
      if (uploadError) throw uploadError;
      
      console.log(`[${job.id}] Signed upload completed.`);
    } catch (uploadErr) {
      console.error(`[${job.id}] Upload Error:`, uploadErr.message);
      throw new Error(`Upload failed: ${uploadErr.message}`);
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
        // Queue is empty, wait 5 seconds before next poll
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (err) {
      console.error('Main loop error:', err.message);
      // On error, wait longer before retrying (30s)
      await new Promise(r => setTimeout(r, 30000));
    }
  }
}

main();
