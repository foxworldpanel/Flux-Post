
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
