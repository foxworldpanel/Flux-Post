import { supabase } from "@/integrations/supabase/client";

export const musicService = {
  async getMusics(artistId?: string) {
    let query = supabase.from("music_tracks").select("*, artists(name)");
    if (artistId) {
      query = query.eq("artist_id", artistId);
    }
    const { data, error } = await query.order("criado_em", { ascending: false });
    if (error) throw error;
    return data;
  },

  async createMusic(music: any) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("music_tracks")
      .insert({ ...music, user_id: user?.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};
