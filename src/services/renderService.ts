import { supabase } from "@/integrations/supabase/client";
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

  /**
   * Request a render job to be processed server-side.
   * This now just enqueues the job in the database.
   */
  async requestRender(options: RenderOptions) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const renderKey = await this.generateRenderKey(options);
    
    // Check if we already have a ready render
    const existing = await this.getRender(renderKey);
    if (existing && existing.status === 'ready') {
      return existing;
    }

    // Upsert the job with "queued" status for the worker to pick up
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
        status: 'queued',
        attempts: 0
      }, { onConflict: 'render_key' })
      .select()
      .single();

    if (createError) throw createError;
    return render;
  }
};
