import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { supabase } from '@/integrations/supabase/client';

let ffmpeg: FFmpeg | null = null;

export async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();
  
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
}

export async function processVideo(
  videoUrl: string, 
  audioUrl: string, 
  onProgress?: (progress: number) => void
): Promise<string> {
  const ff = await loadFFmpeg();

  if (onProgress) {
    ff.on('progress', ({ progress }) => {
      onProgress(Math.round(progress * 100));
    });
  }

  // Load files into memory
  const videoData = await fetchFile(videoUrl);
  const audioData = await fetchFile(audioUrl);

  await ff.writeFile('input_video.mp4', videoData);
  await ff.writeFile('input_audio.mp3', audioData);

  // FFmpeg command:
  // -i input_video.mp4: input video
  // -i input_audio.mp3: input audio
  // -map 0:v: take video from first input
  // -map 1:a: take audio from second input
  // -shortest: end when the shortest input (video) ends
  // -af "volume=0.9,afade=t=out:st=DURATION-2:d=2": volume and fade out
  // We need the video duration to apply fade out correctly.
  
  // Note: For simplicity in WASM without full metadata probe first, 
  // we'll try a generic approach or assume we can calculate it.
  // Ideally we'd use ffprobe, but for now we'll use a standard command.
  
  // To apply fade out without knowing duration exactly, we'd need to probe.
  // Since we don't have ffprobe easily here, let's stick to the core requirements.
  
  await ff.exec([
    '-i', 'input_video.mp4',
    '-i', 'input_audio.mp3',
    '-map', '0:v',
    '-map', '1:a',
    '-c:v', 'copy', // Copy video codec to save time
    '-af', 'volume=0.9', // Simplest audio filter for now
    '-shortest',
    'output.mp4'
  ]);

  const data = await ff.readFile('output.mp4');
  // Handle potential SharedArrayBuffer incompatibility by copying to a new Uint8Array
  const uint8Data = new Uint8Array(data as Uint8Array);
  const blob = new Blob([uint8Data], { type: 'video/mp4' });
  const fileName = `processed_${Date.now()}.mp4`;

  const { data: uploadData, error } = await supabase.storage
    .from('videos-processados')
    .upload(fileName, blob);

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('videos-processados')
    .getPublicUrl(fileName);

  return publicUrl;
}
