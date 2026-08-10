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
    
    // Generate unique slug server-side via RPC to prevent race conditions and duplicate keys
    const { data: slug, error: slugError } = await supabase.rpc('generate_unique_artist_slug', {
      p_name: artist.name,
      p_user_id: user?.id
    });

    if (slugError) throw new Error("Erro ao gerar slug único: " + slugError.message);

    const { data, error } = await supabase
      .from("artists")
      .insert({ ...artist, slug, user_id: user?.id } as ArtistInsert)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error("Já existe um artista com esse nome ou slug. Por favor, escolha outro.");
      }
      throw error;
    }
    return data;
  },

  async updateArtist(id: string, updates: ArtistUpdate): Promise<Artist> {
    const { data: { user } } = await supabase.auth.getUser();

    let finalUpdates = { ...updates };

    // If name is changing, regenerate slug
    if (updates.name) {
      const { data: slug, error: slugError } = await supabase.rpc('generate_unique_artist_slug', {
        p_name: updates.name,
        p_user_id: user?.id,
        p_exclude_id: id
      });

      if (slugError) throw new Error("Erro ao gerar slug único: " + slugError.message);
      finalUpdates.slug = slug;
    }

    const { data, error } = await supabase
      .from("artists")
      .update(finalUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error("Já existe um artista com esse nome ou slug. Por favor, escolha outro.");
      }
      throw error;
    }
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
