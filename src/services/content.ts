import { supabase } from "@/integrations/supabase/client";

export const contentService = {
  async searchPexels({ query, orientation, page = 1, per_page = 20 }: {
    query: string;
    orientation?: string;
    page?: number;
    per_page?: number;
  }) {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.functions.invoke("pexels-search", {
      body: { query, orientation, page, per_page },
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });

    if (error) throw error;
    return data;
  },

  async importPexelsVideo({ videoId, category, candidateId }: { videoId: number; category: string; candidateId?: string }) {
    const { data: { session } } = await supabase.auth.getSession();

    const { data, error } = await supabase.functions.invoke("import-pexels-content", {
      body: { videoId, category },
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });

    if (error) {
      console.error("[CONTENT SERVICE] Error calling Edge Function:", error);
      
      if (error.name === 'FunctionsHttpError') {
        try {
          const details = await (error as any).context?.json();
          if (details) throw details;
        } catch (e) {
          throw error;
        }
      }
      throw error;
    }

    if (candidateId) {
      await supabase
        .from('content_candidates')
        .update({ 
          status: 'aprovado', 
          reviewed_at: new Date().toISOString() 
        })
        .eq('id', candidateId);
    }

    return data;
  },

  async runDiscovery() {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("run-content-discovery", {
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });
    if (error) throw error;
    return data;
  },

  async discardCandidate(id: string) {
    const { error } = await supabase
      .from('content_candidates')
      .update({ 
        status: 'descartado', 
        reviewed_at: new Date().toISOString() 
      })
      .eq('id', id);
    if (error) throw error;
  },

  // Restored methods
  async getLibrary() {
    const { data, error } = await supabase
      .from('content_library')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getSignedUrl(path: string) {
    const { data, error } = await supabase.storage
      .from('content-library')
      .createSignedUrl(path, 3600); // 1 hour

    if (error) throw error;
    return data.signedUrl;
  }
};
