import { FFmpeg } from '@ffmpeg/ffmpeg';

const ffmpeg = new FFmpeg();

export async function loadFFmpeg() {
  if (ffmpeg.loaded) return;
  
  try {
    console.log('Iniciando carregamento do FFmpeg local...');
    await ffmpeg.load();
    console.log('FFmpeg carregado com sucesso!');
  } catch (error) {
    console.error('Erro ao carregar FFmpeg local:', error);
    throw error;
  }
}

export async function processVideo(
  videoUrl: string,
  musicUrl: string,
  options: {
    musicStartMs?: number;
    musicVolume?: number;
    originalAudioVolume?: number;
    audioMode: 'only_music' | 'music_plus_original' | 'only_original';
  },
  onLog?: (message: string) => void
): Promise<Blob> {
  await loadFFmpeg();

  if (onLog) {
    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg]', message);
      onLog(message);
    });
  }

  try {
    console.log('1. Baixando vídeo via fetch:', videoUrl);
    const videoResponse = await fetch(videoUrl);
    if (!videoResponse.ok) throw new Error(`Falha ao baixar vídeo: ${videoResponse.statusText}`);
    const videoBlob = await videoResponse.blob();
    const videoBuffer = await videoBlob.arrayBuffer();
    await ffmpeg.writeFile('video.mp4', new Uint8Array(videoBuffer));

    let ffmpegArgs: string[] = [];

    if (options.audioMode === 'only_original') {
      ffmpegArgs = ['-i', 'video.mp4', '-c:v', 'copy', '-c:a', 'copy', '-y', 'output.mp4'];
    } else {
      console.log('2. Baixando música via fetch:', musicUrl);
      const musicResponse = await fetch(musicUrl);
      if (!musicResponse.ok) throw new Error(`Falha ao baixar música: ${musicResponse.statusText}`);
      const musicBlob = await musicResponse.blob();
      const musicBuffer = await musicBlob.arrayBuffer();
      await ffmpeg.writeFile('music.mp3', new Uint8Array(musicBuffer));

      const musicStartSec = (options.musicStartMs || 0) / 1000;
      const musicVol = (options.musicVolume ?? 80) / 100;
      const originalVol = (options.originalAudioVolume ?? 20) / 100;

      if (options.audioMode === 'only_music') {
        ffmpegArgs = [
          '-i', 'video.mp4',
          '-ss', musicStartSec.toString(),
          '-i', 'music.mp3',
          '-map', '0:v:0',
          '-map', '1:a:0',
          '-c:v', 'copy',
          '-af', `volume=${musicVol}`,
          '-shortest',
          '-y', 'output.mp4'
        ];
      } else {
        // music_plus_original
        ffmpegArgs = [
          '-i', 'video.mp4',
          '-ss', musicStartSec.toString(),
          '-i', 'music.mp3',
          '-filter_complex',
          `[0:a]volume=${originalVol}[a0];[1:a]volume=${musicVol}[a1];[a0][a1]amix=inputs=2:duration=first[a]`,
          '-map', '0:v:0',
          '-map', '[a]',
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-shortest',
          '-y', 'output.mp4'
        ];
      }
    }

    console.log('3. Executando comando FFmpeg:', ffmpegArgs.join(' '));
    const result = await ffmpeg.exec(ffmpegArgs);

    if (result !== 0) {
      throw new Error(`FFmpeg falhou com código ${result}`);
    }

    const data = await ffmpeg.readFile('output.mp4');
    return new Blob([data as any], { type: 'video/mp4' });
  } catch (error: any) {
    console.error('Erro no processVideo:', error);
    throw error;
  }
}
