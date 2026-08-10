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
  async requireUser() {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.error("[social] erro ao ler sessão local:", error.message);
      throw new Error("Não foi possível ler sua sessão local. Recarregue a página e tente novamente.");
    }
    if (!session?.user) {
      throw new Error("Sua sessão do Flux Post expirou. Entre novamente.");
    }
    console.debug("[social] sessão", {
      sessionExists: true,
      userIdExists: !!session.user.id,
      accessTokenExists: !!session.access_token,
    });
    return session.user;
  },

  /** Gera nome interno automático: "TikTok Conta 01" */
  async generateAccountName(platform: SocialPlatform) {
    const label = platform === 'tiktok' ? 'TikTok'
      : platform === 'instagram' ? 'Instagram'
      : platform === 'youtube' ? 'YouTube' : 'Facebook';

    const { data, error } = await supabase
      .from('social_accounts')
      .select('account_name')
      .eq('platform', platform);

    if (error) throw error;

    let max = 0;
    (data || []).forEach((row: { account_name: string | null }) => {
      const match = row.account_name?.match(/Conta\s+(\d+)$/i);
      if (match) max = Math.max(max, parseInt(match[1], 10));
    });
    const next = Math.max(max, (data?.length || 0)) + 1;
    return `${label} Conta ${String(next).padStart(2, '0')}`;
  },

  /** Cria registro pending mínimo e inicia OAuth via PostPeer. Limpa o pending em caso de falha. */
  async startConnection(platform: SocialPlatform) {
    const user = await this.requireUser();
    const accountName = await this.generateAccountName(platform);

    const { data: pending, error: insertError } = await supabase
      .from('social_accounts')
      .insert({
        user_id: user.id,
        platform,
        account_name: accountName,
        username: accountName.toLowerCase().replace(/\s+/g, '_'),
        provider: 'postpeer',
        connection_status: 'nao_conectada',
        status: 'active',
        posts_per_day: 3,
        timezone: 'America/Sao_Paulo',
        receive_all_campaigns: true,
        preferred_categories: [],
      })
      .select()
      .single();

    if (insertError) throw insertError;

    try {
      const { authorization_url } = await this.connectAccount(pending.id);
      if (!authorization_url) throw new Error("PostPeer não retornou a URL de autorização.");
      return { authorization_url, account: pending };
    } catch (err) {
      // Não deixar lixo no banco
      await supabase.from('social_accounts').delete().eq('id', pending.id);
      throw err;
    }
  },

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
    const user = await this.requireUser();

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
    await this.requireUser();
    const { data, error } = await supabase.functions.invoke('postpeer-connect', {
      body: { social_account_id: socialAccountId }
    });
    
    if (error) {
      let details = '';
      try {
        const ctx = (error as any).context;
        details = ctx ? await ctx.text() : '';
        const body = JSON.parse(details);
        if (body.error === 'postpeer_config_pending') {
          throw new Error("Configuração PostPeer pendente. Informe a API Key do PostPeer para conectar contas.");
        }
        if (body.error === 'Unauthorized') {
          throw new Error("Não foi possível validar sua sessão no servidor.");
        }
        throw new Error(body.message || body.error || error.message);
      } catch (e: any) {
        if (e instanceof Error && e.message) throw e;
        throw new Error(details || error.message);
      }
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
