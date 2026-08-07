import { supabase } from "@/integrations/supabase/client";

export const artistService = {
  async getArtists() {
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .order("name");
    if (error) throw error;
    return data;
  },

  async createArtist(artist: any) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("artists")
      .insert({ ...artist, user_id: user?.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateArtist(id: string, updates: any) {
    const { data, error } = await supabase
      .from("artists")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async ensureSourceeAssociated() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Check if user already has Sourcee
    const { data: existing } = await supabase
      .from("artists")
      .select("id")
      .eq("slug", "sourcee")
      .eq("user_id", user.id)
      .maybeSingle();

    if (existing) return;

    // Try to claim the seed Sourcee (one with NULL user_id)
    const { error } = await supabase
      .from("artists")
      .update({ user_id: user.id })
      .eq("slug", "sourcee")
      .is("user_id", null);
      
    if (error) console.error("Could not auto-associate Sourcee:", error.message);
  }
};
