
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export interface PostPeerIntegration {
  id: string;
  profileId: string;
  platform: string;
  platformUserId: string;
  displayName?: string;
  username?: string;
  handle?: string;
  imageUrl?: string;
  status?: string;
  authStatus?: string;
  authFailureReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface PostPeerMediaItem {
  url: string;
  type: 'video' | 'image' | 'gif';
}

export interface PostPeerPlatformResult {
  platform: string;
  accountId?: string;
  status?: string;
  success?: boolean;
  postId?: string;
  platformPostUrl?: string;
  error?: string;
}

export interface PostPeerCreatePostRequest {
  platforms: {
    platform: string;
    accountId: string; // Integration ID
    platformSpecificData?: {
      title?: string;
      visibility?: "public" | "private" | "unlisted";
      tags?: string[];
      madeForKids?: boolean;
      containsSyntheticMedia?: boolean;
      categoryId?: string;
      firstComment?: string;
    };
  }[];
  content: string;
  mediaItems: PostPeerMediaItem[];
  publishNow?: boolean;
  scheduledFor?: string; // ISO String
  timezone?: string; // e.g. "America/Sao_Paulo"
}

export interface PostPeerCreatePostResponse {
  success: boolean;
  postId: string;
  status: string;
  platforms: PostPeerPlatformResult[];
  publishedAt?: string;
  scheduledAt?: string;
}

export class PostPeerClient {
  private apiKey: string;
  private baseUrl = "https://api.postpeer.dev/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async readJson(res: Response, operation: string): Promise<any> {
    const text = await res.text();

    if (!res.ok) {
      throw new Error(`${operation}: ${text || `HTTP ${res.status}`}`);
    }

    try {
      return text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`${operation}: resposta inválida do provedor`);
    }
  }

  async createProfile(name: string): Promise<{ id: string }> {
    const res = await fetch(`${this.baseUrl}/profiles`, {
      method: 'POST',
      headers: {
        'x-access-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    });
    const payload = await this.readJson(res, 'PostPeer profile creation failed');
    const profile = payload?.profile
      ?? payload?.data?.profile
      ?? payload?.result?.profile
      ?? payload?.profiles?.[0]
      ?? payload?.data?.profiles?.[0]
      ?? payload?.data
      ?? payload?.result
      ?? payload;
    const id = profile?.id ?? profile?.profileId ?? profile?.profile_id;

    if (!id || typeof id !== 'string') {
      const keys = payload && typeof payload === 'object' ? Object.keys(payload).join(', ') : 'none';
      throw new Error(`PostPeer profile creation returned no ID (response fields: ${keys})`);
    }

    return { id };
  }

  async listIntegrations(profileId: string): Promise<PostPeerIntegration[]> {
    const res = await fetch(`${this.baseUrl}/connect/integrations?profileId=${profileId}`, {
      headers: { 'x-access-key': this.apiKey }
    });
    const payload = await this.readJson(res, 'PostPeer listing integrations failed');
    const integrations = Array.isArray(payload)
      ? payload
      : payload?.integrations ?? payload?.data?.integrations ?? payload?.data ?? [];

    if (!Array.isArray(integrations)) {
      throw new Error('PostPeer listing integrations returned an invalid response');
    }

    return integrations;
  }

  async connectPlatform(profileId: string, platform: string, callbackUrl: string): Promise<{ url: string }> {
    return this.getOAuthUrl(platform, profileId, callbackUrl);
  }

  async getOAuthUrl(platform: string, profileId: string, callbackUrl?: string): Promise<{ url: string }> {
    const params = new URLSearchParams({ profileId });
    // PostPeer expects `redirectUri` (not `callbackUrl`) as the URL to return to after OAuth.
    if (callbackUrl) params.set('redirectUri', callbackUrl);

    const res = await fetch(`${this.baseUrl}/connect/${platform.toLowerCase()}?${params.toString()}`, {
      headers: { 'x-access-key': this.apiKey }
    });
    const payload = await this.readJson(res, 'PostPeer connection initiation failed');
    const data = payload?.data ?? payload?.result ?? payload;
    const url = data?.url
      ?? data?.authUrl
      ?? data?.oauthUrl
      ?? data?.connectUrl
      ?? data?.authorizationUrl
      ?? data?.authorization_url;

    if (!url || typeof url !== 'string') {
      const keys = payload && typeof payload === 'object' ? Object.keys(payload).join(', ') : 'none';
      throw new Error(`PostPeer connection returned no authorization URL (response fields: ${keys})`);
    }

    return { url };
  }

  async checkHealth(): Promise<any> {
    const res = await fetch(`${this.baseUrl}/health`, {
      headers: { 'x-access-key': this.apiKey }
    });
    return this.readJson(res, 'PostPeer health check failed');
  }

  async createPost(payload: PostPeerCreatePostRequest): Promise<PostPeerCreatePostResponse> {
    const res = await fetch(`${this.baseUrl}/posts`, {
      method: 'POST',
      headers: {
        'x-access-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`PostPeer post creation failed: ${await res.text()}`);
    return res.json();
  }

  async getPost(postId: string): Promise<PostPeerCreatePostResponse> {
    const res = await fetch(`${this.baseUrl}/posts/${postId}`, {
      headers: { 'x-access-key': this.apiKey }
    });
    if (!res.ok) throw new Error(`PostPeer get post failed: ${await res.text()}`);
    return res.json();
  }
}
