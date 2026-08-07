import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-client@2'

const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })
    }

    const { videoId, category, metadata } = await req.json()

    if (!videoId) {
      return new Response(JSON.stringify({ error: 'videoId is required' }), { status: 400, headers: corsHeaders })
    }

    // 1. Fetch video info from Pexels to get the actual download URL
    const pexelsRes = await fetch(`https://api.pexels.com/videos/videos/${videoId}`, {
      headers: { 'Authorization': PEXELS_API_KEY! }
    })
    const videoData = await pexelsRes.json()

    if (!videoData || videoData.error) {
      return new Response(JSON.stringify({ error: 'Video not found in Pexels' }), { status: 404, headers: corsHeaders })
    }

    // 2. Select best vertical version
    const files = videoData.video_files || []
    let selectedFile = files.find((f: any) => f.width === 1080 && f.height === 1920)
    if (!selectedFile) {
        selectedFile = files.find((f: any) => f.width < f.height) // Any vertical
    }
    if (!selectedFile) {
        selectedFile = files[0] // Fallback
    }

    if (!selectedFile) {
      return new Response(JSON.stringify({ error: 'No suitable video file found' }), { status: 404, headers: corsHeaders })
    }

    // 3. Download the video
    const videoRes = await fetch(selectedFile.link)
    const blob = await videoRes.blob()

    // 4. Upload to Supabase Storage
    const fileName = `${user.id}/pexels/${videoId}/${Date.now()}.mp4`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('content-library')
      .upload(fileName, blob, {
        contentType: 'video/mp4',
        upsert: false
      })

    if (uploadError) throw uploadError

    // 5. Create record in content_library
    const { data: record, error: dbError } = await supabase
      .from('content_library')
      .insert({
        user_id: user.id,
        title: `Pexels Video ${videoId}`,
        file_path: fileName,
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

    return new Response(
      JSON.stringify({ success: true, record }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error(error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
