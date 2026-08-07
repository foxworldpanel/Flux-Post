import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const PEXELS_API_KEY = Deno.env.get('PEXELS_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!PEXELS_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'PEXELS_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { query, orientation, size, per_page = 20, page = 1 } = await req.json()

    let url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${per_page}&page=${page}`
    if (orientation) url += `&orientation=${orientation}`
    if (size) url += `&size=${size}`

    const response = await fetch(url, {
      headers: {
        'Authorization': PEXELS_API_KEY
      }
    })

    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
