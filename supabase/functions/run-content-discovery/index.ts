import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DiscoveryReportItem {
  category: string;
  term: string;
  found: number;
  added: number;
  status: 'success' | 'error';
  error?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized', stage: 'auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token', stage: 'auth' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (!PEXELS_API_KEY) {
      return new Response(JSON.stringify({ error: 'PEXELS_API_KEY not configured', stage: 'config' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: settings } = await supabase
      .from('content_discovery_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!settings) {
      return new Response(JSON.stringify({ error: 'Configuração do Garimpo não encontrada. Configure na aba Automação.', stage: 'config' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: categories } = await supabase
      .from('content_discovery_categories')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true)

    if (!categories || categories.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhuma categoria ativa configurada.', stage: 'config' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: libraryItems } = await supabase
      .from('content_library')
      .select('category')
      .eq('user_id', user.id)
    
    const { data: candidatesItems } = await supabase
      .from('content_candidates')
      .select('category')
      .eq('user_id', user.id)
      .eq('status', 'pendente')

    const libStats: Record<string, number> = {}
    libraryItems?.forEach(i => libStats[i.category] = (libStats[i.category] || 0) + 1)
    
    const candStats: Record<string, number> = {}
    candidatesItems?.forEach(i => candStats[i.category] = (candStats[i.category] || 0) + 1)

    const discoveryPlan = categories
      .map(cat => {
        const currentTotal = (libStats[cat.name] || 0) + (candStats[cat.name] || 0)
        const deficit = Math.max(0, cat.target_count - currentTotal)
        return { ...cat, currentTotal, deficit }
      })
      .filter(cat => cat.deficit > 0)
      .sort((a, b) => b.deficit - a.deficit)

    if (discoveryPlan.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'Estoque completo. Nenhuma categoria abaixo da meta.', summary: { total_added: 0, categories_analyzed: categories.length, details: [] } }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let totalAdded = 0
    const report: DiscoveryReportItem[] = []
    const maxExecutionCount = settings.max_per_execution || 20

    for (const cat of discoveryPlan) {
      if (totalAdded >= maxExecutionCount) break

      const searchTerms = cat.search_terms || []
      if (searchTerms.length === 0) {
        report.push({ category: cat.name, term: 'N/A', found: 0, added: 0, status: 'error', error: 'Sem termos de busca' })
        continue
      }

      const term = searchTerms[Math.floor(Math.random() * searchTerms.length)]
      const orientation = settings.default_orientation === 'all' ? '' : `&orientation=${settings.default_orientation}`
      const pexelsUrl = `https://api.pexels.com/videos/search?query=${encodeURIComponent(term)}&per_page=15&page=1${orientation}`
      
      try {
        const pexelsRes = await fetch(pexelsUrl, {
          headers: { 'Authorization': PEXELS_API_KEY }
        })

        if (pexelsRes.status === 429) {
          report.push({ category: cat.name, term, found: 0, added: 0, status: 'error', error: 'Rate limit (429)' })
          break 
        }

        if (!pexelsRes.ok) throw new Error(`Pexels API error: ${pexelsRes.status}`)
        
        const data = await pexelsRes.json()
        const videos = data.videos || []
        let catAdded = 0

        for (const video of videos) {
          if (totalAdded >= maxExecutionCount) break
          if (video.duration < (settings.min_duration || 5) || video.duration > (settings.max_duration || 60)) continue
          
          const { data: existsLib } = await supabase.from('content_library').select('id').eq('user_id', user.id).eq('source', 'pexels').eq('external_id', video.id.toString()).maybeSingle()
          if (existsLib) continue

          const { data: existsCand } = await supabase.from('content_candidates').select('id').eq('user_id', user.id).eq('source', 'pexels').eq('external_id', video.id.toString()).maybeSingle()
          if (existsCand) continue

          const { error: insertErr } = await supabase.from('content_candidates').insert({
            user_id: user.id,
            source: 'pexels',
            external_id: video.id.toString(),
            original_url: video.url,
            preview_url: video.image,
            author: video.user.name,
            category: cat.name,
            search_term: term,
            duration: video.duration,
            width: video.width,
            height: video.height,
            orientation: video.width < video.height ? 'portrait' : 'landscape',
            metadata: { pexels_id: video.id, user: video.user, video_files: video.video_files }
          })

          if (!insertErr) {
            totalAdded++
            catAdded++
          }
        }
        
        report.push({ category: cat.name, term, found: videos.length, added: catAdded, status: 'success' })
      } catch (err: any) {
        console.error(`Error searching for ${cat.name}:`, err)
        report.push({ category: cat.name, term, found: 0, added: 0, status: 'error', error: err.message })
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: totalAdded > 0 ? `${totalAdded} novos candidatos encontrados.` : 'Nenhum candidato novo compatível encontrado.',
      summary: { total_added: totalAdded, categories_analyzed: categories.length, details: report }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('[run-content-discovery] Fatal error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal error', success: false }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
