// index.ts - Supabase Edge Function (Deno) with move-on-scan logic
// Paste this entire file into your Supabase Edge Function `sample-movement` -> Code -> Save & Deploy

import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.34.0";

// Environment secrets (set these in the Supabase Function Secrets UI)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const FN_SECRET = Deno.env.get('FN_SECRET') || '' // optional, extra protection

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  global: {
    headers: {
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
  },
})

// Helpers
function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-fn-secret',
  }
}
function json(body: any, status = 200, origin = '*') {
  const headers = { ...corsHeaders(origin), 'Content-Type': 'application/json' }
  return new Response(JSON.stringify(body), { status, headers })
}

serve(async (req: Request) => {
  const fnName = 'sample-movement'
  try {
    const url = new URL(req.url)
    const originalPath = req.headers.get('x-original-path') || url.pathname || ''
    console.log('[REQ] method=', req.method, 'originalPath=', originalPath)

    // Normalize path
    let subpath = originalPath
    const prefixes = [
      `/functions/v1/${fnName}`,
      `/${fnName}`,
      `/functions/v1`,
    ]
    for (const p of prefixes) {
      if (subpath.startsWith(p)) {
        subpath = subpath.slice(p.length)
        break
      }
    }
    if (!subpath || !subpath.startsWith('/')) subpath = '/' + (subpath || '')
    console.log('[REQ] normalized subpath=', subpath)

    if (req.method === 'OPTIONS') {
      const origin = req.headers.get('origin') || '*'
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    if (FN_SECRET) {
      const incoming = req.headers.get('x-fn-secret') || ''
      if (incoming !== FN_SECRET) {
        return json({ error: 'Unauthorized - invalid function secret' }, 401)
      }
    }

    if (req.method === 'GET' && (subpath === '/' || subpath === '/health' || subpath === '/status')) {
      return json({ message: 'ok' }, 200)
    }

    // Core: POST /samples
    if (req.method === 'POST' && subpath === '/samples') {
      const payload = await req.json().catch(() => null)
      if (!payload) return json({ error: 'Invalid JSON body' }, 400)

      // Accept { sample: {...} } or { samples: [...] } or raw object/array
      let samples: any[] = []
      if (payload.sample) samples = Array.isArray(payload.sample) ? payload.sample : [payload.sample]
      else if (payload.samples) samples = Array.isArray(payload.samples) ? payload.samples : [payload.samples]
      else if (Array.isArray(payload)) samples = payload
      else if (typeof payload === 'object') samples = [payload]
      else return json({ error: 'Unrecognized payload shape' }, 400)

      // Normalize each sample minimally
      samples = samples.map((raw: any) => {
        const s: any = { ...raw }
        if (s.position !== undefined && s.position !== null) {
          try { s.position = String(s.position).trim().toUpperCase() } catch {}
        }
        if (s.sampleId && !s.sample_id) s.sample_id = s.sampleId
        if (s.sample_id !== undefined && s.sample_id !== null) {
          try { s.sample_id = String(s.sample_id).trim().toUpperCase() } catch {}
        }
        if (s.containerId && !s.container_id) s.container_id = s.containerId
        return s
      })

      // Basic validation
      const missing = samples.find(s => !s || !s.sample_id || !s.container_id)
      if (missing) return json({ error: 'Each sample must include sample_id and container_id' }, 400)

      // Call RPC in bulk and return its result. The RPC should accept a jsonb array
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('samples_upsert_v1', { sample_json: samples })
        if (rpcErr) {
          console.error('RPC samples_upsert_v1 error (bulk):', rpcErr)
          return json({ success: false, error: String(rpcErr) }, 500)
        }
        return json({ success: true, data: rpcData }, 200)
      } catch (e) {
        console.error('Exception calling bulk RPC:', e)
        return json({ success: false, error: String(e) }, 500)
      }
    }

    // Not found
    return json({ error: 'Not found' }, 404)
  } catch (err) {
    console.error('Function handler error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
