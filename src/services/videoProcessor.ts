import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

export const loadFFmpeg = async (onLog?: (message: string) => void) => {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();
  
  if (onLog) {
    ffmpeg.on("log", ({ message }) => onLog(message));
  }

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
};

export const processVideo = async (
  videoUrl: string,
  musicUrl: string,
  onProgress?: (progress: number) => void
): Promise<Uint8Array> => {
  const ffmpeg = await loadFFmpeg();

  if (onProgress) {
    ffmpeg.on("progress", ({ progress }) => onProgress(progress));
  }

  // Write files to memory
  await ffmpeg.writeFile("video.mp4", await fetchFile(videoUrl));
  await ffmpeg.writeFile("music.mp3", await fetchFile(musicUrl));

  // Run command: replace audio, keep shortest duration
  // -i video.mp4 -i music.mp3 -map 0:v -map 1:a -c:v copy -shortest output.mp4
  await ffmpeg.exec([
    "-i", "video.mp4",
    "-i", "music.mp3",
    "-map", "0:v",
    "-map", "1:a",
    "-c:v", "copy",
    "-shortest",
    "output.mp4"
  ]);

  const data = await ffmpeg.readFile("output.mp4");
  return data as Uint8Array;
};
