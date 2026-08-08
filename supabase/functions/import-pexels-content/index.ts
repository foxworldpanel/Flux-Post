import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PexelsVideoFile {
  id: number;
  quality: string;
  file_type: string;
  width: number;
  height: number;
  link: string;
  file_size?: number;
}

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image: string;
  duration: number;
  user: {
    name: string;
    url: string;
  };
  video_files: PexelsVideoFile[];
}

const MAX_STORAGE_SIZE = 100 * 1024 * 1024; // 100MB

function selectBestVideoFile(files: PexelsVideoFile[]): PexelsVideoFile | null {
  if (!files || files.length === 0) return null;

  // 1. Filter vertical (portrait) files
  const verticalFiles = files.filter(f => f.height > f.width);
  
  if (verticalFiles.length > 0) {
    // Priority B/C: Near 1080x1920, avoid low res
    // Prefer MP4 (Priority E)
    const mp4Verticals = verticalFiles.filter(f => f.file_type === 'video/mp4');
    const targetVerticals = mp4Verticals.length > 0 ? mp4Verticals : verticalFiles;

    // Sort by proximity to 1920 height, but favor not exceeding 100MB (Priority D)
    return targetVerticals.sort((a, b) => {
      // Favor files with file_size if available
      if (a.file_size && a.file_size > MAX_STORAGE_SIZE) return 1;
      if (b.file_size && b.file_size > MAX_STORAGE_SIZE) return -1;

      const diffA = Math.abs(a.height - 1920);
      const diffB = Math.abs(b.height - 1920);
      return diffA - diffB;
    })[0];
  }

  // Fallback to any file if no vertical found
  return files.sort((a, b) => (a.file_size || 0) - (b.file_size || 0))[0];
}

serve(async (req) => {
  console.log(`[IMPORT] Request received: ${req.method} ${req.url}`);
  console.log(`[IMPORT] SECRETS CHECK: PEXELS_API_KEY=${!!PEXELS_API_KEY}, SUPABASE_URL=${!!SUPABASE_URL}, SUPABASE_SERVICE_ROLE_KEY=${!!SUPABASE_SERVICE_ROLE_KEY}`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204, 
      headers: corsHeaders 
    });
  }

  // PING TEST: Confirm function is reachable
  const url = new URL(req.url);
  if (url.searchParams.has('ping')) {
    return new Response(JSON.stringify({ message: 'pong', status: 'ready' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('[IMPORT] No authorization header');
      return new Response(JSON.stringify({ error: 'No authorization header', success: false, stage: 'auth' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!PEXELS_API_KEY) {
      console.error('[IMPORT] PEXELS_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'PEXELS_API_KEY not configured', success: false, stage: 'config' }), { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      console.error('[IMPORT] Auth failed:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized', success: false, stage: 'auth' }), { 
        status: 401, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`[IMPORT] user authenticated: ${user.id}`);

    const { videoId, category } = await req.json()

    if (!videoId) {
      console.error('[IMPORT] videoId is missing');
      return new Response(JSON.stringify({ error: 'videoId is required', success: false, stage: 'input' }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`[IMPORT] checking duplicate for videoId: ${videoId}`);

    // --- DUPLICATE CHECK ---
    const { data: existing } = await supabase
      .from('content_library')
      .select('id')
      .eq('user_id', user.id)
      .eq('source', 'pexels')
      .eq('external_id', videoId.toString())
      .maybeSingle()

    if (existing) {
      console.log('[IMPORT] duplicate found');
      return new Response(
        JSON.stringify({ 
          success: false, 
          duplicate: true, 
          existing_content_id: existing.id,
          message: 'Este conteúdo já está na sua Biblioteca.',
          stage: 'duplicate_check'
        }), 
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Fetch metadata
    console.log('[IMPORT] fetching Pexels metadata');
    const pexelsRes = await fetch(`https://api.pexels.com/videos/videos/${videoId}`, {
      headers: { 'Authorization': PEXELS_API_KEY }
    })
    
    if (!pexelsRes.ok) {
      const status = pexelsRes.status
      console.error(`[IMPORT] Pexels API status: ${status}`);
      if (status === 429) return new Response(JSON.stringify({ error: 'Pexels rate limit', success: false, stage: 'pexels_fetch' }), { status: 429, headers: corsHeaders })
      if (status === 404) return new Response(JSON.stringify({ error: 'Video not found in Pexels', success: false, stage: 'pexels_fetch' }), { status: 404, headers: corsHeaders })
      return new Response(JSON.stringify({ error: `Pexels API error: ${status}`, success: false, stage: 'pexels_fetch' }), { status, headers: corsHeaders })
    }

    const videoData: PexelsVideo = await pexelsRes.json()
    console.log('[IMPORT] selecting video file');
    const selectedFile = selectBestVideoFile(videoData.video_files);

    if (!selectedFile) {
      console.error('[IMPORT] no selected file found');
      return new Response(JSON.stringify({ error: 'No suitable video file found', success: false, stage: 'file_selection' }), { 
        status: 422, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    console.log(`[IMPORT] selected file: ${selectedFile.width}x${selectedFile.height}, ${selectedFile.file_type}`);

    // 2. Download
    console.log('[IMPORT] downloading');
    const videoRes = await fetch(selectedFile.link)
    if (!videoRes.ok) {
      console.error(`[IMPORT] download failed: ${videoRes.status}`);
      return new Response(JSON.stringify({ error: 'Falha no download do vídeo', success: false, stage: 'download' }), { status: 502, headers: corsHeaders })
    }

    const blob = await videoRes.blob()
    console.log(`[IMPORT] download success, size: ${blob.size}`);

    if (blob.size > MAX_STORAGE_SIZE) {
      console.error('[IMPORT] file too large');
      return new Response(JSON.stringify({ error: 'Arquivo excede 100MB', success: false, stage: 'download' }), { status: 413, headers: corsHeaders })
    }

    // 3. Storage
    console.log('[IMPORT] uploading storage');
    const fileName = `${user.id}/pexels/${videoId}/original.mp4`
    const { error: uploadError } = await supabase.storage
      .from('content-library')
      .upload(fileName, blob, {
        contentType: 'video/mp4',
        upsert: true
      })

    if (uploadError) {
      console.error('[IMPORT] storage upload error:', uploadError);
      return new Response(JSON.stringify({ error: uploadError.message, success: false, stage: 'storage_upload' }), { status: 500, headers: corsHeaders })
    }

    // 4. Database
    try {
      console.log('[IMPORT] inserting database');
      const { data: record, error: dbError } = await supabase
        .from('content_library')
        .insert({
          user_id: user.id,
          title: `Pexels Video ${videoId}`,
          storage_path: fileName,
          file_type: 'video',
          category: category || 'Outros',
          status: 'aprovado',
          source: 'pexels',
          external_id: videoId.toString(),
          author: videoData.user.name,
          original_url: videoData.url,
          credit: `Video by ${videoData.user.name} from Pexels`,
          license_info: 'Pexels License',
          use_count: 0
        })
        .select()
        .single()

      if (dbError) throw dbError

      console.log('[IMPORT] success');
      return new Response(
        JSON.stringify({ success: true, record }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (dbError) {
      console.error('[IMPORT] FAILED stage: database_insert', {
        name: dbError.name,
        message: dbError.message
      })
      await supabase.storage.from('content-library').remove([fileName])
      return new Response(
        JSON.stringify({ error: dbError.message, success: false, stage: 'database_insert' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  } catch (error) {
    console.error('[IMPORT] FAILED stage: unknown', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error)
    })
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro interno na importação',
        stage: 'unknown'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

