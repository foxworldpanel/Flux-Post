import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

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
  onLog?: (message: string) => void
): Promise<Blob> {
  await loadFFmpeg();

  if (onLog) {
    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
      onLog(message);
    });
  }

  try {
    console.log('3. Baixando vídeo:', videoUrl);
    await ffmpeg.writeFile('video.mp4', await fetchFile(videoUrl));
    
    console.log('5. Baixando música:', musicUrl);
    await ffmpeg.writeFile('music.mp3', await fetchFile(musicUrl));

    console.log('7. Executando FFmpeg...');
    const result = await ffmpeg.exec([
      '-i', 'video.mp4',
      '-i', 'music.mp3',
      '-map', '0:v',
      '-map', '1:a',
      '-c:v', 'copy',
      '-shortest',
      'output.mp4'
    ]);

    if (result !== 0) {
      throw new Error(`FFmpeg falhou com código ${result}`);
    }

    const data = await ffmpeg.readFile('output.mp4');
    return new Blob([data as any], { type: 'video/mp4' });
  } catch (error: any) {
    console.error('Erro no processVideo:', error);
    throw new Error(error?.message || 'Erro durante o processamento do vídeo');
  }
}
