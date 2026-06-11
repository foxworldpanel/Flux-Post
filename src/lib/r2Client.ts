import { S3Client } from "@aws-sdk/client-s3";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: import.meta.env.VITE_R2_ENDPOINT_URL || "",
  credentials: {
    accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID || "",
    secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY || "",
  },
});

export const BUCKETS = {
  musicas: "fluxpost-musicas",
  videos: "fluxpost-videos",
  processados: "fluxpost-processados",
};

// Helper to get public URL for R2 objects
// Assuming a custom domain or the R2 public endpoint is configured.
// For now, we'll build a generic URL pattern, but users usually need to provide their R2 public domain.
export const getR2PublicUrl = (bucket: string, key: string) => {
  // If the user has a public domain for R2, they should replace this.
  // Many users use a worker or a custom domain.
  // We'll return the path and let the UI handle the base URL if needed, 
  // or return a constructed URL if we had the base.
  // Given the request asks to save the public URL, we'll need a base URL.
  const baseUrl = import.meta.env.VITE_R2_PUBLIC_URL || "";
  return `${baseUrl}/${key}`;
};
