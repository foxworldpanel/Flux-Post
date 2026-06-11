import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

export async function processVideo(
  videoUrl: string, 
  musicUrl: string,
  onLog?: (message: string) => void
): Promise<Blob> {
  if (onLog) {
    ffmpeg.on("log", ({ message }) => onLog(message));
  }

  if (!ffmpeg.loaded) {
    // Using UMD versions as requested for better compatibility in some environments
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.js`, 
        'text/javascript'
      ),
      wasmURL: await toBlobURL(
        `${baseURL}/ffmpeg-core.wasm`, 
        'application/wasm'
      ),
    });
  }

  await ffmpeg.writeFile('video.mp4', await fetchFile(videoUrl));
  await ffmpeg.writeFile('music.mp3', await fetchFile(musicUrl));

  await ffmpeg.exec([
    '-i', 'video.mp4',
    '-i', 'music.mp3',
    '-map', '0:v',
    '-map', '1:a',
    '-c:v', 'copy',
    '-shortest',
    'output.mp4'
  ]);

  const data = await ffmpeg.readFile('output.mp4');
  return new Blob(
    [data], 
    { type: 'video/mp4' }
  );
}
