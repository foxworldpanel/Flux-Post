import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-client@2'

const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), { status: 401, headers: corsHeaders })
    }

    if (!PEXELS_API_KEY) throw new Error('PEXELS_API_KEY not configured')

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { videoId, category } = await req.json()

    if (!videoId) {
      return new Response(JSON.stringify({ error: 'videoId is required' }), { status: 400, headers: corsHeaders })
    }

    // --- DUPLICATE CHECK BEFORE DOWNLOAD ---
    const { data: existing } = await supabase
      .from('content_library')
      .select('id')
      .eq('user_id', user.id)
      .eq('source', 'pexels')
      .eq('external_id', videoId.toString())
      .maybeSingle()

    if (existing) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          duplicate: true, 
          existing_content_id: existing.id,
          message: 'Este conteúdo já está na sua Biblioteca.' 
        }), 
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 1. Fetch video info from Pexels
    const pexelsRes = await fetch(`https://api.pexels.com/videos/videos/${videoId}`, {
      headers: { 'Authorization': PEXELS_API_KEY }
    })
    
    if (!pexelsRes.ok) {
      const status = pexelsRes.status
      if (status === 429) return new Response(JSON.stringify({ error: 'Pexels rate limit' }), { status: 429, headers: corsHeaders })
      return new Response(JSON.stringify({ error: 'Video not found in Pexels' }), { status: 404, headers: corsHeaders })
    }

    const videoData: PexelsVideo = await pexelsRes.json()
    const selectedFile = selectBestVideoFile(videoData.video_files);

    if (!selectedFile) {
      return new Response(JSON.stringify({ error: 'No suitable video file found' }), { status: 404, headers: corsHeaders })
    }

    // 2. Head check for size if possible
    const headRes = await fetch(selectedFile.link, { method: 'HEAD' });
    const contentLength = headRes.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_STORAGE_SIZE) {
      return new Response(JSON.stringify({ error: 'Arquivo muito grande (> 100MB)' }), { status: 400, headers: corsHeaders })
    }

    // 3. Download the video
    const videoRes = await fetch(selectedFile.link)
    const blob = await videoRes.blob()

    if (blob.size > MAX_STORAGE_SIZE) {
      return new Response(JSON.stringify({ error: 'Arquivo baixado excede o limite de 100MB' }), { status: 400, headers: corsHeaders })
    }

    // 4. Upload to Supabase Storage - DETERMINISTIC PATH
    const fileName = `${user.id}/pexels/${videoId}/original.mp4`
    
    const { error: uploadError } = await supabase.storage
      .from('content-library')
      .upload(fileName, blob, {
        contentType: 'video/mp4',
        upsert: true // Using upsert for resilience, though duplicate check should prevent it
      })

    if (uploadError) throw uploadError

    let recordId = null
    try {
      // 5. Create record in content_library
      const { data: record, error: dbError } = await supabase
        .from('content_library')
        .insert({
          user_id: user.id,
          title: `Pexels Video ${videoId}`,
          storage_path: fileName, // Using storage_path as per schema
          file_type: 'video',
          category: category || 'Outros',
          status: 'aprovado',
          source: 'pexels',
          external_id: videoId.toString(),
          author: videoData.user.name,
          original_url: videoData.url,
          credit: `Video by ${videoData.user.name} from Pexels`,
          license_info: 'Pexels License',
          usage_count: 0
        })
        .select()
        .single()

      if (dbError) throw dbError
      recordId = record.id

      return new Response(
        JSON.stringify({ success: true, record }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } catch (dbError) {
      // --- CLEANUP ORPHAN STORAGE FILE ---
      console.error('[import-pexels-content] DB Insert failed, cleaning up storage:', dbError)
      await supabase.storage.from('content-library').remove([fileName])
      throw dbError
    }
  } catch (error) {
    console.error('[import-pexels-content]', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno na importação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
