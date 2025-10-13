// index.ts - Supabase Edge Function (Deno) with move-on-scan logic
// Paste this entire file into your Supabase Edge Function `sample-movement` -> Code -> Save & Deploy

import { serve } from "https://deno.land/std@0.200.0/http/server.ts";
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

      // Load containers once
      const { data: containersData, error: contErr } = await supabase.from('containers').select('*')
      if (contErr) {
        console.error('Failed to load containers:', contErr)
        return json({ error: 'Failed to load containers', details: contErr }, 500)
      }
      const containers = containersData || []

      const results: any[] = []
      const toUpsert: any[] = []

      for (const sample of samples) {
        const targetContainerId = sample.container_id
        const thisContainer = containers.find((c: any) => String(c.id) === String(targetContainerId))
        const targetIsArchive = thisContainer?.is_archived || thisContainer?.status === 'archived' || thisContainer?.isArchived

        // Fetch all existing rows for this sample_id, including archived flag
        const { data: existingSamples, error: fetchErr } = await supabase
          .from('samples')
          .select('id,container_id,is_archived')
          .eq('sample_id', sample.sample_id)

        if (fetchErr) {
          console.error('Error fetching existing samples for', sample.sample_id, fetchErr)
          results.push({ sample_id: sample.sample_id, success: false, error: fetchErr })
          continue
        }

        // Separate archived vs non-archived rows
        const existing = existingSamples || []
        const nonArchived = existing.filter((r: any) => !(r.is_archived === true)) // treat null/undefined as non-archived
        const archived = existing.filter((r: any) => r.is_archived === true)

        // If target is NOT archived, we must ensure only one non-archived row exists and that it ends up in the target container
        if (!targetIsArchive) {
          if (nonArchived.length > 0) {
            // If any non-archived row already lives in target container, update that row with any new fields (defer to upsert)
            const inTarget = nonArchived.find((r: any) => String(r.container_id) === String(targetContainerId))
            if (inTarget) {
              // Update will be done via upsert (set id so we update)
              sample.id = inTarget.id
              toUpsert.push(sample)
              continue
            }

            // Otherwise, pick one non-archived row to move (the first). Delete any other non-archived duplicates.
            const toMove = nonArchived[0]
            try {
              const now = new Date().toISOString()
              const { data: movedData, error: moveErr } = await supabase
                .from('samples')
                .update({ container_id: targetContainerId, last_updated: now })
                .eq('id', toMove.id)
                .select('*')

              if (moveErr) {
                console.warn('Failed to move sample row id=', toMove.id, moveErr)
                results.push({ sample_id: sample.sample_id, success: false, error: moveErr })
                continue
              }

              // Delete any remaining non-archived duplicates (beyond the moved row)
              const others = nonArchived.slice(1)
              for (const o of others) {
                try {
                  await supabase.from('samples').delete().eq('id', o.id)
                } catch (e) {
                  console.warn('Failed to delete extra non-archived duplicate id=', o.id, e)
                }
              }

              // We've moved an authoritative non-archived row to the target container; record result
              results.push({ sample_id: sample.sample_id, success: true, action: 'moved', to_container_id: targetContainerId, data: movedData })
              // No upsert required for this sample
              continue
            } catch (e) {
              console.error('Exception while moving sample', sample.sample_id, e)
              results.push({ sample_id: sample.sample_id, success: false, error: String(e) })
              continue
            }
          } else {
            // No non-archived rows exist; we'll insert/upsert into target (allowed)
            toUpsert.push(sample)
            continue
          }
        } else {
          // target is archived -> duplicates allowed; just insert/upsert
          toUpsert.push(sample)
          continue
        }
      }

      // Bulk upsert remaining samples
      if (toUpsert.length > 0) {
        try {
          const upsertRes = await supabase.from('samples').upsert(toUpsert, { onConflict: ['sample_id'] }).select()
          if (upsertRes.error) {
            const err = upsertRes.error
            const message = String(err?.message || '')
            if (err?.code === '42P10' || message.includes('ON CONFLICT')) {
              console.warn('Bulk upsert ON CONFLICT failed, falling back to per-sample update/insert', err)
            } else {
              console.error('Bulk upsert failed:', err)
              for (const s of toUpsert) results.push({ sample_id: s.sample_id, success: false, error: err })
              return json({ success: false, results }, 500)
            }
          } else {
            const dataArray = Array.isArray(upsertRes.data) ? upsertRes.data : [upsertRes.data]
            for (const row of dataArray) {
              results.push({ sample_id: row.sample_id, success: true, kind: 'upsert', data: row })
            }
          }
        } catch (e) {
          console.warn('Bulk upsert threw, falling back:', e)
        }
      }

      // Fallback per-sample update->insert for any pending
      const handledIds = new Set(results.map(r => r.sample_id))
      const pending = toUpsert.filter(s => !handledIds.has(s.sample_id))

      for (const s of pending) {
        try {
          const updateRes = await supabase.from('samples').update(s).eq('sample_id', s.sample_id).select('*')
          if (updateRes.error) {
            console.warn('Fallback update error for', s.sample_id, updateRes.error)
            const insertRes = await supabase.from('samples').insert(s).select('*')
            if (insertRes.error) {
              results.push({ sample_id: s.sample_id, success: false, error: insertRes.error })
            } else {
              results.push({ sample_id: s.sample_id, success: true, action: 'insert', data: insertRes.data })
            }
          } else {
            const updatedRows = Array.isArray(updateRes.data) ? updateRes.data.length : (updateRes.data ? 1 : 0)
            if (updatedRows > 0) {
              results.push({ sample_id: s.sample_id, success: true, action: 'update', data: updateRes.data })
            } else {
              const insertRes = await supabase.from('samples').insert(s).select('*')
              if (insertRes.error) {
                results.push({ sample_id: s.sample_id, success: false, error: insertRes.error })
              } else {
                results.push({ sample_id: s.sample_id, success: true, action: 'insert', data: insertRes.data })
              }
            }
          }
        } catch (e) {
          console.error('Per-sample fallback exception for', s.sample_id, e)
          results.push({ sample_id: s.sample_id, success: false, error: String(e) })
        }
      }

      return json({ success: true, results }, 200)
    }

    // Not found
    return json({ error: 'Not found' }, 404)
  } catch (err) {
    console.error('Function handler error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
