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

// Pexels API Key - uses Edge Function as proxy to keep key server-side
// Falls back to direct API call if Edge Function fails
const PEXELS_API_KEY = import.meta.env.VITE_PEXELS_API_KEY || '';

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
    // Try Edge Function first
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("pexels-search", {
        body: { query, orientation, size, locale, type, page, per_page, exclude_ids, ensure_min_results },
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      if (!error && data) return data;
    } catch (e) {
      console.warn('[CONTENT] Edge Function failed, trying direct Pexels API:', e);
    }

    // Fallback: direct Pexels API
    if (!PEXELS_API_KEY) throw new Error('PEXELS_API_KEY não configurada');
    
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (orientation && orientation !== 'all') params.set('orientation', orientation);
    if (size) params.set('size', size);
    if (locale) params.set('locale', locale);
    params.set('page', String(page));
    params.set('per_page', String(per_page));

    const endpoint = type === 'popular' 
      ? `https://api.pexels.com/videos/popular?${params}`
      : `https://api.pexels.com/videos/search?${params}`;

    const res = await fetch(endpoint, {
      headers: { Authorization: PEXELS_API_KEY }
    });

    if (!res.ok) throw new Error(`Pexels API error: ${res.status}`);
    const json = await res.json();
    return { videos: json.videos || [], total_results: json.total_results || 0 };
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
    // Try Edge Function first
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("import-pexels-content", {
        body: { videoId, category },
        headers: { Authorization: `Bearer ${session?.access_token}` }
      });
      
      if (!error && data) {
        if (candidateId) {
          await supabase.from('content_candidates')
            .update({ status: 'aprovado', reviewed_at: new Date().toISOString() })
            .eq('id', candidateId);
        }
        return data;
      }
    } catch (e) {
      console.warn('[CONTENT] Edge Function import failed, using direct import:', e);
    }

    // Fallback: import directly from Pexels API and save to content_library
    console.log('[CONTENT] Importing directly from Pexels API...');
    
    // Fetch video details from Pexels if not provided
    let finalVideoData = videoData;
    
    if (!finalVideoData && PEXELS_API_KEY) {
      const res = await fetch(`https://api.pexels.com/videos/videos/${videoId}`, {
        headers: { Authorization: PEXELS_API_KEY }
      });
      if (res.ok) {
        finalVideoData = await res.json();
      }
    }

    const currentVideoData = finalVideoData;

    // Get best video file (prefer HD portrait/vertical)
    const getBestFile = (files: any[]) => {
      if (!files || files.length === 0) return null;
      const sorted = [...files].sort((a, b) => {
        const aScore = (a.quality === 'hd' ? 2 : 1) + (a.height > a.width ? 1 : 0);
        const bScore = (b.quality === 'hd' ? 2 : 1) + (b.height > b.width ? 1 : 0);
        return bScore - aScore;
      });
      return sorted[0];
    };

    const bestFile = videoData?.video_files ? getBestFile(videoData.video_files) : null;
    const videoUrl = bestFile?.link || `https://www.pexels.com/video/${videoId}/`;
    const thumbnailUrl = videoData?.image || videoData?.video_pictures?.[0]?.picture;
    const duration = videoData?.duration || 30;
    const width = bestFile?.width || videoData?.width || 1080;
    const height = bestFile?.height || videoData?.height || 1920;
    const orientation = height > width ? 'portrait' : width > height ? 'landscape' : 'square';
    const author = videoData?.user?.name || 'Pexels';

    // Save to content_library using the video URL as storage_path
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado');

    const { data: inserted, error: insertError } = await supabase
      .from('content_library')
      .upsert({
        user_id: user.id,
        title: videoData?.url ? `Pexels Video ${videoId}` : `Video ${videoId}`,
        storage_path: videoUrl,
        thumbnail_url: thumbnailUrl,
        source: 'pexels',
        external_id: String(videoId),
        original_url: videoData?.url || `https://www.pexels.com/video/${videoId}/`,
        duration_seconds: duration,
        category: category,
        orientation: orientation,
        author: author,
        status: 'new',
        niche: category,
        tags: videoData?.tags?.map((t: any) => t.title) || [],
        license_info: 'Pexels License - Free to use',
      }, {
        onConflict: 'external_id,user_id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (insertError) {
      console.error('[CONTENT] Error inserting to content_library:', insertError);
      throw insertError;
    }

    if (candidateId) {
      await supabase.from('content_candidates')
        .update({ status: 'aprovado', reviewed_at: new Date().toISOString() })
        .eq('id', candidateId);
    }

    console.log('[CONTENT] Video imported successfully:', inserted?.id);
    return { success: true, content: inserted };
  },

  async runDiscovery(): Promise<DiscoveryReport> {
    const { data: { session } } = await supabase.auth.getSession();
    const { data, error } = await supabase.functions.invoke("run-content-discovery", {
      headers: { Authorization: `Bearer ${session?.access_token}` }
    });
    if (error) throw error;
    return data;
  },

  async discardCandidate(id: string) {
    const { error } = await supabase
      .from('content_candidates')
      .update({ status: 'descartado', reviewed_at: new Date().toISOString() })
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

  async getSignedUrl(storagePath: string) {
    // If it's already a full URL (Pexels or external), return as-is
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      return storagePath;
    }

    // Try content-library bucket first
    try {
      const { data, error } = await supabase.storage
        .from('content-library')
        .createSignedUrl(storagePath, 3600);
      if (!error && data) return data.signedUrl;
    } catch (e) {}

    // Try videos bucket
    try {
      const { data, error } = await supabase.storage
        .from('videos')
        .createSignedUrl(storagePath, 3600);
      if (!error && data) return data.signedUrl;
    } catch (e) {}

    // Return path as-is as last resort
    return storagePath;
  }
};
