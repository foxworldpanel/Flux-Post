import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

export async function processVideo(
  videoUrl: string, 
  musicUrl: string,
  onLog?: (message: string) => void
): Promise<Blob> {
  if (onLog) {
    ffmpeg.on("log", ({ message }) => {
      console.log('FFmpeg log:', message);
      onLog(message);
    });
  }

  try {
    if (!ffmpeg.loaded) {
      console.log('1. Iniciando carregamento FFmpeg...');
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
      console.log('2. FFmpeg carregado!');
    } else {
      console.log('FFmpeg já estava carregado.');
    }

    console.log('3. Baixando vídeo:', videoUrl);
    const videoData = await fetchFile(videoUrl);
    await ffmpeg.writeFile('video.mp4', videoData);
    console.log('4. Vídeo baixado e escrito no FS virtual!');

    console.log('5. Baixando música:', musicUrl);
    const musicData = await fetchFile(musicUrl);
    await ffmpeg.writeFile('music.mp3', musicData);
    console.log('6. Música baixada e escrita no FS virtual!');

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
      throw new Error(`FFmpeg exec falhou com código ${result}`);
    }
    console.log('8. FFmpeg concluído!');

    const data = await ffmpeg.readFile('output.mp4');
    console.log('9. Arquivo de saída lido com sucesso!');

    return new Blob(
      [data as any], 
      { type: 'video/mp4' }
    );
  } catch (error: any) {
    console.error('Erro completo no videoProcessor:', error);
    throw new Error(
      error?.message || 
      JSON.stringify(error) || 
      'Erro desconhecido durante o processamento de vídeo'
    );
  }
}
