
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Encrypts a string using AES-GCM via Web Crypto API.
 * Returns a base64 encoded string containing the IV and the ciphertext.
 */
export async function encryptToken(text: string, secretKey: string): Promise<string> {
  if (!secretKey) throw new Error("Encryption key missing");
  
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  
  // Hash the secret key to ensure it's 256 bits (32 bytes)
  const keyBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(secretKey));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  const encryptedArray = new Uint8Array(encrypted);
  const result = new Uint8Array(iv.length + encryptedArray.length);
  result.set(iv);
  result.set(encryptedArray, iv.length);
  
  return btoa(String.fromCharCode(...result));
}

/**
 * Decrypts a string using AES-GCM via Web Crypto API.
 */
export async function decryptToken(encryptedBase64: string, secretKey: string): Promise<string> {
  if (!secretKey) throw new Error("Encryption key missing");
  
  const encoder = new TextEncoder();
  const binaryString = atob(encryptedBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  
  const keyBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(secretKey));
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  return new TextDecoder().decode(decrypted);
}


export interface TikTokTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
  open_id: string;
  scope: string;
  error?: string;
  error_description?: string;
}

export interface TikTokUserInfoResponse {
  data: {
    user: {
      open_id: string;
      union_id?: string;
      avatar_url?: string;
      display_name?: string;
      bio_description?: string;
      is_verified?: boolean;
    };
  };
  error?: {
    code: string;
    message: string;
    log_id: string;
  };
}

// --- PostPeer Types ---

export type SocialProviderName = 'postpeer' | 'tiktok_direct' | 'meta_direct' | 'youtube_direct';

export interface PostPeerProfile {
  id: string;
  name: string;
  created_at: string;
}

export interface PostPeerIntegration {
  id: string;
  profileId: string;
  platform: string;
  platformUserId: string;
  displayName: string;
  imageUrl: string;
  status: 'active' | 'expired' | 'error';
  createdAt: string;
  updatedAt: string;
}

export interface PostPeerApiError {
  error: string;
  message: string;
  code?: string;
}

/**
 * PostPeer API Wrapper (v1 .dev)
 */
export class PostPeerClient {
  private apiKey: string;
  private baseUrl = "https://api.postpeer.dev/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        "x-access-key": this.apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = { error: "invalid_json", message: "Failed to parse API response" };
    }

    if (!response.ok) {
      throw {
        error: data.error || "postpeer_api_error",
        message: data.message || "Unknown error from PostPeer",
        status: response.status,
      };
    }

    return data as T;
  }

  async createProfile(name: string): Promise<PostPeerProfile> {
    return this.request("/profiles", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async getOAuthUrl(platform: string, profileId: string, redirectUri: string): Promise<{ url: string }> {
    const params = new URLSearchParams({
      profileId,
      redirectUri
    });
    return this.request(`/connect/${platform}?${params.toString()}`);
  }

  async listIntegrations(profileId: string): Promise<PostPeerIntegration[]> {
    return this.request(`/connect/integrations?profileId=${profileId}`);
  }

  async disconnectIntegration(integrationId: string): Promise<{ success: boolean }> {
    return this.request(`/connect/integrations/${integrationId}`, {
      method: "DELETE",
    });
  }
}


