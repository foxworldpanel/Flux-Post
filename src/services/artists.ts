import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Artist = Database["public"]["Tables"]["artists"]["Row"];
type ArtistInsert = Database["public"]["Tables"]["artists"]["Insert"];
type ArtistUpdate = Database["public"]["Tables"]["artists"]["Update"];

export const artistService = {
  async getArtists(): Promise<Artist[]> {
    const { data, error } = await supabase
      .from("artists")
      .select("*")
      .order("name");
    if (error) throw error;
    return data || [];
  },

  async createArtist(artist: Omit<ArtistInsert, "user_id">): Promise<Artist> {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("artists")
      .insert({ ...artist, user_id: user?.id } as ArtistInsert)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateArtist(id: string, updates: ArtistUpdate): Promise<Artist> {
    const { data, error } = await supabase
      .from("artists")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async ensureSourceeAssociated(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Use RPC to safely claim Sourcee seed
    const { data, error } = await supabase.rpc('claim_sourcee_seed');
    
    if (error) {
      console.error("Erro ao associar Sourcee via RPC:", error.message);
    } else {
      console.log("Resultado da associação Sourcee:", data);
    }
  }
};
