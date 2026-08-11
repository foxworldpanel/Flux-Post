import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authentication required
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!PEXELS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'PEXELS_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
      page = 1 
    } = body

    const safePerPage = Math.min(Math.max(1, per_page), 80)
    const safePage = Math.max(1, page)
    
    let url = ''
    if (type === 'popular') {
      url = `https://api.pexels.com/v1/videos/popular?per_page=${safePerPage}&page=${safePage}`
    } else {
      if (!query || query.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'Query is required for search' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      url = `https://api.pexels.com/v1/videos/search?query=${encodeURIComponent(query)}&per_page=${safePerPage}&page=${safePage}`
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
          JSON.stringify({ error: 'Limite de taxa do Pexels atingido. Tente novamente mais tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      return new Response(
        JSON.stringify({ error: `Pexels API error: ${status}` }),
        { status: status >= 500 ? 502 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[pexels-search]', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno ao processar pesquisa' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
