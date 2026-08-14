import { supabase } from "@/integrations/supabase/client";
import { storageService } from "./storage";
import { toast } from "sonner";

export interface RenderOptions {
  videoId: string;
  musicId?: string;
  musicStartMs?: number;
  musicVolume?: number;
  originalAudioVolume?: number;
  audioMode: 'only_music' | 'music_plus_original' | 'only_original';
  outputProfile?: string;
}

export const renderService = {
  async generateRenderKey(options: RenderOptions): Promise<string> {
    const parts = [
      options.videoId,
      options.musicId || 'none',
      options.musicStartMs || 0,
      options.audioMode,
      options.musicVolume ?? 80,
      options.originalAudioVolume ?? 20,
      options.outputProfile || 'short_vertical_v1'
    ];
    
    const text = parts.join('|');
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async getRender(renderKey: string) {
    const { data, error } = await supabase
      .from('media_renders')
      .select('*')
      .eq('render_key', renderKey)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  },

  async requestRender(options: RenderOptions, onProgress?: (step: string, progress: number) => void) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const renderKey = await this.generateRenderKey(options);
    
    // 1. Check cache
    const existing = await this.getRender(renderKey);
    if (existing && existing.status === 'ready') {
      console.log("[RENDER ENGINE] Cache Hit:", renderKey);
      return existing;
    }

    if (existing && existing.status === 'processing') {
      console.log("[RENDER ENGINE] Already processing:", renderKey);
      // Wait or return processing status
      return existing;
    }

    // 2. Create job in DB
    const { data: render, error: createError } = await supabase
      .from('media_renders')
      .upsert({
        user_id: user.id,
        render_key: renderKey,
        source_content_id: options.videoId,
        music_track_id: options.musicId,
        music_start_ms: options.musicStartMs,
        audio_mode: options.audioMode,
        music_volume: options.musicVolume,
        original_audio_volume: options.originalAudioVolume,
        output_profile: options.outputProfile || 'short_vertical_v1',
        status: 'processing',
        started_at: new Date().toISOString()
      }, { onConflict: 'render_key' })
      .select()
      .single();

    if (createError) throw createError;

    try {
      // 3. Perform actual render (Client-side for now)
      if (onProgress) onProgress('downloading', 10);
      
      // Get URLs
      const { data: videoData } = await supabase.from('content_library').select('storage_path').eq('id', options.videoId).single();
      const { data: musicData } = options.musicId ? await supabase.from('music_tracks').select('storage_path').eq('id', options.musicId).single() : { data: null };

      if (!videoData) throw new Error("Vídeo não encontrado");
      
      // Get signed URL for private content
      const { data: signedVideo } = await supabase.storage.from('content-library').createSignedUrl(videoData.storage_path, 3600);
      if (!signedVideo) throw new Error("Erro ao gerar URL do vídeo");

      let musicUrl = '';
      if (musicData?.storage_path) {
        // Se o path for uma URL (legado), usa direto. Se for o novo path relativo, gera signed URL.
        if (musicData.storage_path.startsWith('http')) {
          musicUrl = musicData.storage_path;
        } else {
          const { data: signedMusic } = await supabase.storage.from('musicas').createSignedUrl(musicData.storage_path, 3600);
          if (signedMusic) musicUrl = signedMusic.signedUrl;
        }
      }

          if (msg.includes("Running command")) onProgress?.('processing', 60);
        }
      );

      // 4. Upload result
      if (onProgress) onProgress('uploading', 90);
      const fileName = `${user.id}/${renderKey}.mp4`;
      const { error: uploadError } = await supabase.storage
        .from('rendered') // We need to create this bucket
        .upload(fileName, blob, { upsert: true, contentType: 'video/mp4' });

      if (uploadError) throw uploadError;

      // 5. Update DB to READY
      const { data: finalRender, error: updateError } = await supabase
        .from('media_renders')
        .update({
          status: 'ready',
          storage_path: fileName,
          completed_at: new Date().toISOString(),
          file_size: blob.size
        })
        .eq('id', render.id)
        .select()
        .single();

      if (updateError) throw updateError;
      
      if (onProgress) onProgress('ready', 100);
      return finalRender;

    } catch (error: any) {
      console.error("[RENDER ENGINE] Error:", error);
      await supabase.from('media_renders').update({
        status: 'failed',
        error_message: error.message
      }).eq('id', render.id);
      throw error;
    }
  }
};
