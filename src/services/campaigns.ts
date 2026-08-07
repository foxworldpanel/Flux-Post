import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Campanha = Database["public"]["Tables"]["campanhas"]["Row"];
type CampanhaInsert = Database["public"]["Tables"]["campanhas"]["Insert"];
type CampanhaUpdate = Database["public"]["Tables"]["campanhas"]["Update"];

export const campaignService = {
  async getCampaigns(): Promise<any[]> {
    const { data, error } = await supabase
      .from("campanhas")
      .select("*, artists(name), music_tracks(nome)")
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getActiveCampaign(): Promise<any | null> {
    const { data, error } = await supabase
      .from("campanhas")
      .select("*, artists(name), music_tracks(nome)")
      .eq("status", "ativo")
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async createCampaign(campaign: Omit<CampanhaInsert, "user_id">, contentIds: string[] = []): Promise<Campanha> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    const { data, error } = await supabase
      .from("campanhas")
      .insert({ ...campaign, user_id: user.id } as CampanhaInsert)
      .select()
      .single();

    if (error) throw error;

    if (contentIds.length > 0) {
      const contentInserts = contentIds.map(contentId => ({
        campaign_id: data.id,
        content_id: contentId
      }));
      
      const { error: contentError } = await supabase
        .from("campaign_contents")
        .insert(contentInserts);
        
      if (contentError) console.error("Erro ao vincular conteúdos à campanha:", contentError.message);
    }

    return data;
  },

  async updateCampaign(id: string, updates: CampanhaUpdate, contentIds?: string[]): Promise<Campanha> {
    const { data, error } = await supabase
      .from("campanhas")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    if (contentIds !== undefined) {
      // Refresh relations
      await supabase
        .from("campaign_contents")
        .delete()
        .eq("campaign_id", id);

      if (contentIds.length > 0) {
        const contentInserts = contentIds.map(contentId => ({
          campaign_id: id,
          content_id: contentId
        }));
        
        const { error: contentError } = await supabase
          .from("campaign_contents")
          .insert(contentInserts);
          
        if (contentError) console.error("Erro ao atualizar conteúdos da campanha:", contentError.message);
      }
    }

    return data;
  },

  async getCampaignContents(campaignId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from("campaign_contents")
      .select("content_id, content_library(*)")
      .eq("campaign_id", campaignId);
    
    if (error) throw error;
    return data?.map(d => d.content_library) || [];
  }
};
