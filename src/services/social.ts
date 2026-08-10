import { supabase } from "@/integrations/supabase/client";

export type SocialPlatform = 'tiktok' | 'instagram' | 'youtube' | 'facebook';
export type ConnectionStatus = 'nao_conectada' | 'conectada' | 'token_expirado' | 'erro' | 'requer_reconexao';
export type OperationalStatus = 'active' | 'paused' | 'archived';
export type SocialProviderName = 'postpeer' | 'tiktok_direct' | 'meta_direct' | 'youtube_direct';

export interface SocialAccount {
  id: string;
  user_id: string;
  artist_id?: string;
  platform: SocialPlatform;
  account_name: string;
  username: string;
  external_account_id?: string;
  profile_image_url?: string;
  status: OperationalStatus;
  editorial_profile?: string;
  preferred_categories: string[];
  posts_per_day: number;
  timezone: string;
  posting_enabled: boolean;
  receive_all_campaigns: boolean;
  last_post_at?: string;
  last_sync_at?: string;
  connection_status: ConnectionStatus;
  token_expires_at?: string;
  provider?: SocialProviderName;
  provider_connection_id?: string;
  provider_account_id?: string;
  provider_profile_id?: string;
  provider_status?: string;
  connected_at?: string;

  metadata: any;
  created_at: string;
  updated_at: string;
}

export const socialService = {
  async getAccounts() {
    const { data, error } = await supabase
      .from('social_accounts')
      .select(`
        *,
        artist:artists(id, name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async createAccount(account: Partial<SocialAccount>) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const { data, error } = await supabase
      .from('social_accounts')
      .insert({
        ...account,
        user_id: user.id,
        connection_status: 'nao_conectada',
        status: account.status || 'active'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
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
    return this.updateAccount(id, { status: 'archived' });
  },

  async connectAccount(socialAccountId: string) {
    const { data, error } = await supabase.functions.invoke('postpeer-connect', {
      body: { social_account_id: socialAccountId }
    });
    
    if (error) {
      // Tratar erro específico de configuração pendente
      try {
        const errorBody = JSON.parse(await error.response.text());
        if (errorBody.error === 'postpeer_config_pending') {
          throw new Error("Configuração PostPeer pendente.");
        }
      } catch (e) {}
      throw error;
    }
    
    return data; // { authorization_url }
  },

  async startTikTokOAuth(socialAccountId: string) {
    const { data, error } = await supabase.functions.invoke('tiktok-oauth-start', {
      body: { social_account_id: socialAccountId }
    });
    if (error) throw error;
    return data; // { authorization_url }
  },

  async disconnectAccount(id: string) {
    const { data, error } = await supabase.functions.invoke('social-account-disconnect', {
      body: { social_account_id: id }
    });
    
    if (error) throw error;
    return data;
  },

  async syncAccount(id: string) {
    const { data, error } = await supabase.functions.invoke('postpeer-sync', {
      body: { social_account_id: id }
    });
    
    if (error) throw error;
    return data;
  }

};
