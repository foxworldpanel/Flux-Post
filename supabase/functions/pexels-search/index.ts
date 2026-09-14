import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0"

const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PexelsSearchRequest {
  query?: string;
  type?: 'search' | 'popular';
  orientation?: 'landscape' | 'portrait' | 'square';
  size?: 'small' | 'medium' | 'large';
  locale?: string;
  per_page?: number;
  page?: number;
  exclude_ids?: string[];
  ensure_min_results?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (!PEXELS_API_KEY || !SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return new Response(JSON.stringify({ error: 'Server configuration missing' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body: PexelsSearchRequest = await req.json()
    const {
      query, type = 'search', orientation, size, locale,
      per_page = 40, page = 1, exclude_ids = [], ensure_min_results = 0,
    } = body

    if (type === 'search' && (!query || query.trim().length === 0)) {
      return new Response(JSON.stringify({ error: 'Query is required for search' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // O servidor mantém a memória permanente. Não dependemos apenas da tela:
    // qualquer Pexels que já entrou na biblioteca deixa de aparecer novamente,
    // inclusive depois que o arquivo físico for limpo.
    const { data: history, error: historyError } = await supabase
      .from('content_library')
      .select('external_id, source')
      .eq('user_id', user.id)

    if (historyError) throw new Error(`Content history failed: ${historyError.message}`)

    const excluded = new Set<string>(exclude_ids.map(id => String(id)))
    for (const item of history || []) {
      if ((!item.source || item.source === 'pexels') && item.external_id) {
        excluded.add(String(item.external_id))
      }
    }

    // Descartados também não devem reaparecer.
    const { data: discarded } = await supabase
      .from('content_candidates')
      .select('external_id')
      .eq('status', 'descartado')

    for (const item of discarded || []) {
      if (item.external_id) excluded.add(String(item.external_id))
    }

    const safePerPage = Math.min(Math.max(1, per_page), 80)
    const desiredResults = Math.min(80, Math.max(safePerPage, ensure_min_results || 0))
    const collected: any[] = []
    const collectedIds = new Set<string>()
    let currentPage = Math.max(1, page)
    let totalResults = 0
    let ignoredCount = 0
    let hasMore = true
    let pagesScanned = 0
    const maxPagesToScan = 10

    while (collected.length < desiredResults && hasMore && pagesScanned < maxPagesToScan) {
      let url = type === 'popular'
        ? `https://api.pexels.com/v1/videos/popular?per_page=${safePerPage}&page=${currentPage}`
        : `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(query!)}&per_page=${safePerPage}&page=${currentPage}`

      if (orientation) url += `&orientation=${orientation}`
      if (size) url += `&size=${size}`
      if (locale) url += `&locale=${locale}`

      const response = await fetch(url, { headers: { 'Authorization': PEXELS_API_KEY } })
      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Limite de taxa do Pexels atingido. Tente novamente mais tarde.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          })
        }
        return new Response(JSON.stringify({ error: `Pexels API error: ${response.status}` }), {
          status: response.status >= 500 ? 502 : 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }

      const data = await response.json()
      totalResults = data.total_results || totalResults
      const videos = Array.isArray(data.videos) ? data.videos : []

      for (const video of videos) {
        const id = String(video.id)
        if (excluded.has(id)) { ignoredCount++; continue }
        if (collectedIds.has(id)) continue
        collectedIds.add(id)
        collected.push(video)
      }

      pagesScanned++
      hasMore = Boolean(data.next_page) && videos.length > 0
      currentPage++
    }

    return new Response(JSON.stringify({
      videos: collected,
      total_results: totalResults,
      page,
      per_page: safePerPage,
      next_page: hasMore ? currentPage : null,
      next_page_number: hasMore ? currentPage : null,
      ignored_count: ignoredCount,
      pages_scanned: pagesScanned,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error: any) {
    console.error('[pexels-search]', error?.message || String(error))
    return new Response(JSON.stringify({ error: error?.message || 'Erro interno ao processar pesquisa' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
