
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
  status: string;
  updatedAt: string;
}

export interface PostPeerMediaItem {
  url: string;
  type: 'VIDEO' | 'IMAGE';
}

export interface PostPeerPlatformResult {
  platform: string;
  accountId: string;
  status: string;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface PostPeerCreatePostRequest {
  platforms: {
    platform: string;
    accountId: string; // Integration ID
  }[];
  content: string;
  mediaItems: PostPeerMediaItem[];
  publishNow?: boolean;
  scheduledFor?: string; // ISO String
  timezone?: string; // e.g. "America/Sao_Paulo"
}

export interface PostPeerCreatePostResponse {
  id: string;
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

  async createProfile(name: string): Promise<{ id: string }> {
    const res = await fetch(`${this.baseUrl}/profiles`, {
      method: 'POST',
      headers: {
        'x-access-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name })
    });
    if (!res.ok) throw new Error(`PostPeer profile creation failed: ${await res.text()}`);
    return res.json();
  }

  async listIntegrations(profileId: string): Promise<PostPeerIntegration[]> {
    const res = await fetch(`${this.baseUrl}/connect/integrations?profileId=${profileId}`, {
      headers: { 'x-access-key': this.apiKey }
    });
    if (!res.ok) throw new Error(`PostPeer listing integrations failed: ${await res.text()}`);
    return res.json();
  }

  async connectPlatform(profileId: string, platform: string, callbackUrl: string): Promise<{ url: string }> {
    const res = await fetch(`${this.baseUrl}/connect/${platform.toLowerCase()}?profileId=${profileId}&callbackUrl=${encodeURIComponent(callbackUrl)}`, {
      headers: { 'x-access-key': this.apiKey }
    });
    if (!res.ok) throw new Error(`PostPeer connection initiation failed: ${await res.text()}`);
    return res.json();
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
