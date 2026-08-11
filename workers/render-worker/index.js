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
  const { data, error } = await supabase.rpc('claim_next_render_job');
  if (error) {
    console.error('Error claiming job:', error);
    return null;
  }
  return data;
}

async function processJob(job) {
  const workDir = await fs.mkdtemp(path.join(tmpdir(), `render-${job.id}-`));
  console.log(`[${job.id}] Starting process in ${workDir}`);

  try {
    // 1. Get Content Metadata
    const { data: content } = await supabase.from('content_library').select('*').eq('id', job.source_content_id).single();
    const { data: music } = await supabase.from('music_tracks').select('*').eq('id', job.music_track_id).single();

    if (!content || !music) throw new Error('Input files not found in library');

    // 2. Download files
    const videoPath = path.join(workDir, 'input_video.mp4');
    const musicPath = path.join(workDir, 'input_music.mp3');
    const outputPath = path.join(workDir, 'output.mp4');

    const { data: videoData } = await supabase.storage.from('content-library').download(content.storage_path);
    const { data: musicData } = await supabase.storage.from('music-tracks').download(music.storage_path);

    await fs.writeFile(videoPath, Buffer.from(await videoData.arrayBuffer()));
    await fs.writeFile(musicPath, Buffer.from(await musicData.arrayBuffer()));

    // 3. FFmpeg Processing
    const musicStartSec = (job.music_start_ms || 0) / 1000;
    const musicVol = (job.music_volume || 100) / 100;
    const origVol = (job.original_audio_volume || 0) / 100;

    await new Promise((resolve, reject) => {
      let command = ffmpeg(videoPath)
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
        .on('start', (cmd) => console.log(`[${job.id}] FFmpeg: ${cmd}`))
        .on('error', reject)
        .on('end', resolve)
        .save(outputPath);
    });

    // 4. Upload
    const renderKey = job.render_key || `render_${job.id}`;
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
    await supabase.from('media_renders').update({
      status: 'failed',
      error_message: err.message
    }).eq('id', job.id);
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}

async function main() {
  console.log('Render Worker operational. Polling queue...');
  while (true) {
    const job = await claimJob();
    if (job) {
      await processJob(job);
    } else {
      await new Promise(r => setTimeout(r, 5000));
    }
  }
}

main();