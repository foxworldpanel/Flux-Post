import { supabase } from "@/integrations/supabase/client";

export interface DiscoverySettings {
  id: string;
  user_id: string;
  is_active: boolean;
  target_stock: number;
  max_per_execution: number;
  default_orientation: 'landscape' | 'portrait' | 'square' | 'all';
  min_duration: number;
  max_duration: number;
  created_at: string;
  updated_at: string;
}

export interface DiscoveryCategory {
  id: string;
  user_id: string;
  name: string;
  target_count: number;
  is_active: boolean;
  search_terms: string[];
  created_at: string;
}

export interface ContentCandidate {
  id: string;
  user_id: string;
  source: string;
  external_id: string;
  original_url: string;
  preview_url: string;
  author?: string;
  category: string;
  search_term?: string;
  duration?: number;
  width?: number;
  height?: number;
  orientation?: string;
  status: 'pendente' | 'aprovado' | 'descartado';
  metadata?: any;
  discovered_at: string;
  reviewed_at?: string;
}

export interface DiscoveryReportItem {
  category: string;
  term: string;
  found: number;
  added: number;
  status: 'success' | 'error';
  error?: string;
}

export interface DiscoveryReport {
  success: boolean;
  message: string;
  summary: {
    total_added: number;
    categories_analyzed: number;
    details: DiscoveryReportItem[];
  };
}

export const contentService = {
  async searchPexels({ 
    query, 
    orientation, 
    size, 
    locale, 
    type = 'search', 
    page = 1, 
    per_page = 40,
    exclude_ids = [],
    ensure_min_results = 0
  }: {
    query?: string;
    orientation?: string;
    size?: string;
    locale?: string;
    type?: 'search' | 'popular';
    page?: number;
    per_page?: number;
    exclude_ids?: string[];
    ensure_min_results?: number;
  }) {
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.functions.invoke("pexels-search", {
      body: { 
        query, 
        orientation, 
        size, 
        locale, 
        type, 
        page, 
        per_page,
        exclude_ids,
        ensure_min_results
      },
      headers: {
        Authorization: `Bearer ${session?.access_token}`
      }
    });

    if (error) throw error;
    return data;
  },

  async importPexelsVideo({ 
    videoId, 
    category, 
    candidateId,
    videoData
  }: { 
    videoId: number; 
    category: string; 
    candidateId?: string;
    videoData?: any;
  }) {
    const { data: { session } } = await supabase.auth.getSession();

    try {
      // 1. Edge Function Call
      const { data, error } = await supabase.functions.invoke("import-pexels-content", {
        body: { videoId, category },
        headers: {
          Authorization: `Bearer ${session?.access_token}`
        }
      });

      if (error) throw error;

      // 2. If successful and we have a candidateId, update status
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
    } catch (error: any) {
      console.error("[CONTENT SERVICE] Error importing via Edge Function, trying local bypass:", error);

      // 3. Local Bypass (as requested by user)
      if (videoData) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Usuário não autenticado");

        // Determine resolution
        const portrait = videoData.video_files?.find((f: any) => f.height > f.width) || videoData.video_files?.[0];
        const res = portrait ? { width: portrait.width, height: portrait.height } : { width: videoData.width, height: videoData.height };
        const storagePath = portrait?.link || videoData.video_files?.[0]?.link || videoData.url;

        const { data: record, error: dbError } = await supabase
          .from('content_library')
          .upsert({
            user_id: user.id,
            title: videoData.title || `Pexels Video ${videoId}`,
            storage_path: storagePath,
            file_type: 'video',
            category: category || 'Outros',
            status: 'aprovado',
            source: 'pexels',
            external_id: videoId.toString(),
            author: videoData.user?.name || videoData.author || 'Pexels',
            original_url: videoData.url,
            duration_seconds: videoData.duration,
            orientation: res.height > res.width ? 'portrait' : 'landscape',
            metadata: { 
              pexels_id: videoId, 
              width: res.width, 
              height: res.height 
            }
          }, {
            onConflict: 'user_id,source,external_id'
          })
          .select()
          .single();

        if (dbError) throw dbError;

        if (candidateId) {
          await supabase
            .from('content_candidates')
            .update({ 
              status: 'aprovado', 
              reviewed_at: new Date().toISOString() 
            })
            .eq('id', candidateId);
        }

        return { success: true, record, bypass: true };
      }

      throw error;
    }
  },

  async runDiscovery(): Promise<DiscoveryReport> {
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

  async getLibrary() {
    const { data, error } = await supabase
      .from('content_library')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  async getSignedUrl(path: string) {
    if (!path) return "";
    
    // Try content-library first (standard for this service)
    let { data, error } = await supabase.storage
      .from('content-library')
      .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
      // Fallback to 'videos' bucket
      const videosRes = await supabase.storage
        .from('videos')
        .createSignedUrl(path, 3600);
      
      if (videosRes.data?.signedUrl) {
        return videosRes.data.signedUrl;
      }
      
      if (error) throw error;
      throw new Error("Arquivo não encontrado em content-library ou videos");
    }

    return data.signedUrl;
  }

};
