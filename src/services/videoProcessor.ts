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
    console.log('2. Vídeo escrito no FS do FFmpeg');

    console.log('3. Baixando música via fetch:', musicUrl);
    const musicResponse = await fetch(musicUrl);
    if (!musicResponse.ok) throw new Error(`Falha ao baixar música: ${musicResponse.statusText}`);
    const musicBlob = await musicResponse.blob();
    const musicBuffer = await musicBlob.arrayBuffer();
    await ffmpeg.writeFile('music.mp3', new Uint8Array(musicBuffer));
    console.log('4. Música escrita no FS do FFmpeg');

    console.log('5. Executando comando FFmpeg...');
    const result = await ffmpeg.exec([
      '-i', 'video.mp4',
      '-i', 'music.mp3',
      '-map', '0:v',
      '-map', '1:a',
      '-c:v', 'copy',
      '-shortest',
      '-y',
      'output.mp4'
    ]);

    if (result !== 0) {
      throw new Error(`FFmpeg falhou com código ${result}. Verifique os logs do console para detalhes.`);
    }

    const data = await ffmpeg.readFile('output.mp4');
    console.log('6. Processamento concluído com sucesso!');
    return new Blob([data as any], { type: 'video/mp4' });
  } catch (error: any) {
    console.error('Erro detalhado no processVideo:', error);
    throw new Error(error?.message || 'Erro durante o processamento do vídeo');
  }
}
