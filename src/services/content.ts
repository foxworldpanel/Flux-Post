import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";

type Content = Database["public"]["Tables"]["content_library"]["Row"] & {
  source?: string;
  external_id?: string;
  author?: string;
  original_url?: string;
  credit?: string;
  license_info?: string;
};
type ContentInsert = Database["public"]["Tables"]["content_library"]["Insert"];

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const ALLOWED_MIME_TYPES = ["video/mp4", "video/quicktime", "video/x-msvideo"];

export const contentService = {
  async getLibrary(): Promise<Content[]> {
    const { data, error } = await supabase
      .from("content_library")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async uploadContent(
    file: File,
    metadata: Omit<ContentInsert, "storage_path" | "user_id">,
  ): Promise<Content> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Usuário não autenticado");

    // Validation
    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Arquivo excede o limite de 100MB");
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      throw new Error("Formato de vídeo não suportado. Use MP4, MOV ou AVI.");
    }

    const fileName = `${user.id}/${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

    const { error: uploadError } = await supabase.storage
      .from("content-library")
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: false,
      });

    if (uploadError) throw uploadError;

    try {
      const { data, error } = await supabase
        .from("content_library")
        .insert({
          ...metadata,
          storage_path: fileName,
          user_id: user.id,
        } as ContentInsert)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (dbError) {
      await supabase.storage.from("content-library").remove([fileName]);
      throw dbError;
    }
  },

  async getSignedUrl(path: string): Promise<string> {
    const { data, error } = await supabase.storage
      .from("content-library")
      .createSignedUrl(path, 3600); // 1 hour expiry

    if (error) {
      console.error("Erro ao gerar signed URL:", error.message);
      throw error;
    }

    return data.signedUrl;
  },

  async searchPexels(params: {
    query: string;
    orientation?: "landscape" | "portrait" | "square";
    page?: number;
    per_page?: number;
  }) {
    const { data, error } = await supabase.functions.invoke("pexels-search", {
      body: params,
    });

    if (error) throw error;
    return data;
  },

  async importPexelsVideo(params: { videoId: number; category: string }) {
    const { data, error } = await supabase.functions.invoke("import-pexels-content", {
      body: params,
    });

    if (error) throw error;
    return data;
  },

  async checkDuplicate(source: string, externalId: string) {
    const { data, error } = await supabase
      .from("content_library")
      .select("id")
      .eq("source", source)
      .eq("external_id", externalId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },
};
