import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-access-key",
};

export class PostPeerClient {
  private apiKey: string;
  private baseUrl = "https://api.postpeer.dev/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    console.log(`[PostPeer] Requesting ${options.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        "x-access-key": this.apiKey,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const contentType = response.headers.get("content-type");
    let data: any;

    if (contentType && contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch (e) {
        data = { error: "invalid_json", message: "Failed to parse JSON response" };
      }
    } else {
      data = { message: await response.text() };
    }

    if (!response.ok) {
      console.error(`[PostPeer] Error ${response.status}:`, data);
      throw {
        error: data.error || data.code || "postpeer_api_error",
        message: data.message || data.error || "Unknown error from PostPeer",
        status: response.status,
        endpoint: endpoint,
        full_data: data
      };
    }

    return data as T;
  }

  async checkHealth(): Promise<any> {
    return this.request("/health/auth");
  }

  async createProfile(name: string): Promise<any> {
    const data = await this.request<any>("/profiles", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    // PostPeer v1 returns { success: boolean, profile: { id, ... } }
    return data.profile || data;
  }

  async getOAuthUrl(platform: string, profileId: string, redirectUri?: string): Promise<{ url: string }> {
    if (!profileId) {
      throw { error: "missing_profile_id", message: "profileId is required", status: 400 };
    }
    const params = new URLSearchParams({ profileId });
    if (redirectUri) params.append("redirectUri", redirectUri);
    const data = await this.request<any>(`/connect/${platform}?${params.toString()}`);
    // PostPeer v1 returns { url: string } or { success: boolean, url: string }
    return data;
  }
  async listIntegrations(profileId: string): Promise<any[]> {
    if (!profileId) {
      throw { error: "missing_profile_id", message: "profileId is required", status: 400 };
    }
    const data = await this.request<any>(`/connect/integrations?profileId=${profileId}`);
    // PostPeer v1 returns { success: true, count: number, integrations: [...] }
    return data.integrations || [];
  }


export async function encryptToken(text: string, secretKey: string): Promise<string> {
  if (!secretKey) throw new Error("Encryption key missing");
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const keyBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(secretKey));
  const key = await crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const result = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...result));
}

export async function decryptToken(encryptedBase64: string, secretKey: string): Promise<string> {
  if (!secretKey) throw new Error("Encryption key missing");
  const binaryString = atob(encryptedBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const keyBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secretKey));
  const key = await crypto.subtle.importKey("raw", keyBuffer, { name: "AES-GCM" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(decrypted);
}
