import { supabase } from "@/integrations/supabase/client";

export type SocialPlatform = 'tiktok' | 'instagram' | 'facebook' | 'youtube';
export type ConnectionStatus = 'nao_conectada' | 'conectada' | 'requer_reconexao' | 'erro' | 'token_expirado';
export type OperationalStatus = 'active' | 'paused' | 'archived';

export interface SocialAccount {
  id: string;
  user_id: string;
  platform: SocialPlatform;
  account_name: string;
  username: string | null;
  external_account_id: string | null;
  external_display_name: string | null;
  profile_image_url: string | null;
  connection_status: ConnectionStatus;
  status: OperationalStatus;
  provider: string | null;
  provider_profile_id: string | null;
  provider_connection_id: string | null;
  created_at: string;
  updated_at: string;
}

export const socialService = {
  async getAccounts(): Promise<SocialAccount[]> {
    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .neq('status', 'archived')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data as SocialAccount[];
  },

  async getConnectedAccounts(): Promise<SocialAccount[]> {
    const { data, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('connection_status', 'conectada')
      .eq('status', 'active');
    
    if (error) throw error;
    return data as SocialAccount[];
  },

  async updateAccount(id: string, updates: Partial<SocialAccount>) {
    const { data, error } = await supabase
      .from('social_accounts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async archiveAccount(id: string) {
    const { error } = await supabase
      .from('social_accounts')
      .update({ status: 'archived' })
      .eq('id', id);
    
    if (error) throw error;
  },

  async startConnection(platform: SocialPlatform) {
    const { data, error } = await supabase.functions.invoke('tiktok-oauth-start', {
      body: { platform }
    });
    if (error) throw error;
    return data;
  },

  async connectAccount(accountId: string) {
    // Para reconexão, usamos o fluxo de reparo ou reiniciamos
    const { data, error } = await supabase.functions.invoke('postpeer-connect', {
      body: { accountId }
    });
    if (error) throw error;
    return data;
  },

  async disconnectAccount(id: string) {
    const { error } = await supabase
      .from('social_accounts')
      .update({ 
        connection_status: 'nao_conectada',
        provider_connection_id: null 
      })
      .eq('id', id);
    
    if (error) throw error;
  },

  async syncAccount(id: string) {
    const { data, error } = await supabase.functions.invoke('postpeer-sync', {
      body: { accountId: id }
    });
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
        status: payload.scheduled_for ? 'scheduled' : 'publishing'
      })
      .select()
      .single();

    if (error) throw error;

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
