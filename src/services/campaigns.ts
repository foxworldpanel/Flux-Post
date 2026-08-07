import { supabase } from "@/integrations/supabase/client";

export const campaignService = {
  async getCampaigns() {
    const { data, error } = await supabase
      .from("campanhas")
      .select("*, artists(name), music_tracks(nome)")
      .order("criado_em", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getActiveCampaign() {
    const { data, error } = await supabase
      .from("campanhas")
      .select("*, artists(name), music_tracks(nome)")
      .eq("status", "ativo")
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async addCampaignContent(campaignId: string, contentId: string) {
    const { error } = await supabase
      .from("campaign_contents")
      .insert({ campaign_id: campaignId, content_id: contentId });
    if (error) throw error;
  }
};
