import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY')

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!PEXELS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'PEXELS_API_KEY not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const body: PexelsSearchRequest = await req.json()

    const {
      query,
      type = 'search',
      orientation,
      size,
      locale,
      per_page = 40,
      page = 1,
      exclude_ids = [],
      ensure_min_results = 0,
    } = body

    if (type === 'search' && (!query || query.trim().length === 0)) {
      return new Response(
        JSON.stringify({ error: 'Query is required for search' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const safePerPage = Math.min(Math.max(1, per_page), 80)
    const desiredResults = Math.min(
      80,
      Math.max(safePerPage, ensure_min_results || 0)
    )

    const excluded = new Set(
      exclude_ids.map(id => String(id))
    )

    const collected: any[] = []
    const collectedIds = new Set<string>()

    let currentPage = Math.max(1, page)
    let totalResults = 0
    let ignoredCount = 0
    let hasMore = true

    // Limite de segurança: no máximo 10 páginas do Pexels por chamada.
    // Evita consumir a API indefinidamente quando quase tudo já foi utilizado.
    let pagesScanned = 0
    const maxPagesToScan = 10

    while (
      collected.length < desiredResults &&
      hasMore &&
      pagesScanned < maxPagesToScan
    ) {
      let url = ''

      if (type === 'popular') {
        url = `https://api.pexels.com/v1/videos/popular?per_page=${safePerPage}&page=${currentPage}`
      } else {
        url = `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(query!)}&per_page=${safePerPage}&page=${currentPage}`
      }

      if (orientation) url += `&orientation=${orientation}`
      if (size) url += `&size=${size}`
      if (locale) url += `&locale=${locale}`

      const response = await fetch(url, {
        headers: {
          'Authorization': PEXELS_API_KEY
        }
      })

      if (!response.ok) {
        const status = response.status

        if (status === 429) {
          return new Response(
            JSON.stringify({
              error: 'Limite de taxa do Pexels atingido. Tente novamente mais tarde.'
            }),
            {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        return new Response(
          JSON.stringify({ error: `Pexels API error: ${status}` }),
          {
            status: status >= 500 ? 502 : 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const data = await response.json()

      totalResults = data.total_results || totalResults

      const videos = Array.isArray(data.videos)
        ? data.videos
        : []

      for (const video of videos) {
        const id = String(video.id)

        if (excluded.has(id)) {
          ignoredCount++
          continue
        }

        if (collectedIds.has(id)) {
          continue
        }

        collectedIds.add(id)
        collected.push(video)

        if (collected.length >= desiredResults) {
          break
        }
      }

      pagesScanned++

      hasMore = Boolean(data.next_page) && videos.length > 0
      currentPage++
    }

    return new Response(
      JSON.stringify({
        videos: collected,
        total_results: totalResults,
        page,
        per_page: safePerPage,
        next_page: hasMore ? currentPage : null,
        next_page_number: hasMore ? currentPage : null,
        ignored_count: ignoredCount,
        pages_scanned: pagesScanned,
      }),
      {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      }
    )
  } catch (error) {
    console.error('[pexels-search]', error)

    return new Response(
      JSON.stringify({
        error: 'Erro interno ao processar pesquisa'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
