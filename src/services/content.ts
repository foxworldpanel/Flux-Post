import { supabase } from "@/integrations/supabase/client";

export const contentService = {
  async getLibrary() {
    const { data, error } = await supabase
      .from("content_library")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async uploadContent(file: File, metadata: any) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const fileName = `${user.id}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from("content-library")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data, error } = await supabase
      .from("content_library")
      .insert({
        ...metadata,
        storage_path: fileName,
        user_id: user.id
      })
      .select()
      .single();

    if (error) {
      // Cleanup orphan file
      await supabase.storage.from("content-library").remove([fileName]);
      throw error;
    }

    return data;
  }
};
