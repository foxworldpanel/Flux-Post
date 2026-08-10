import { supabase } from "@/integrations/supabase/client";

export const socialService = {
  async getConnectedAccounts() {
    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('connection_status', 'conectada');
    
    if (error) throw error;
    return data;
  },

  async createPublication(payload: {
    content_id: string;
    account_id: string;
    platform: string;
    caption: string;
    scheduled_at?: string;
    timezone?: string;
  }) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('publications')
      .insert({
        ...payload,
        user_id: user.id,
        status: payload.scheduled_at ? 'scheduled' : 'publishing'
      })
      .select()
      .single();

    if (error) throw error;

    // Trigger Edge Function to send to PostPeer
    const { data: funcData, error: funcError } = await supabase.functions.invoke('postpeer-post-create', {
      body: { publicationId: data.id }
    });

    if (funcError) throw funcError;
    return { publication: data, providerResponse: funcData };
  },

  async syncPostStatuses() {
    const { data, error } = await supabase.functions.invoke('postpeer-post-sync');
    if (error) throw error;
    return data;
  }
};
