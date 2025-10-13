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

      // We'll collect per-sample results
      const results: any[] = []
      // We'll collect samples still needing insertion/upsert after move handling
      const toUpsert: any[] = []

      // Process each sample: enforce "move if not archived" semantics
      for (const sample of samples) {
        const targetContainerId = sample.container_id
        const thisContainer = containers.find((c: any) => String(c.id) === String(targetContainerId))
        const targetIsArchive = thisContainer?.is_archived || thisContainer?.status === 'archived' || thisContainer?.isArchived

        // Fetch existing samples with this sample_id
        const { data: existingSamples, error: fetchErr } = await supabase
          .from('samples')
          .select('id,container_id,is_archived')
          .eq('sample_id', sample.sample_id)

        if (fetchErr) {
          console.error('Error fetching existing samples for', sample.sample_id, fetchErr)
          results.push({ sample_id: sample.sample_id, success: false, error: fetchErr })
          continue
        }

        // If target is NOT archive, move any non-archived existing rows to the target container
        let moved = false
        if (!targetIsArchive) {
          for (const es of (existingSamples || [])) {
            // Skip rows already in target container
            if (String(es.container_id) === String(targetContainerId)) continue

            // Determine whether the other container is archived
            const otherContainer = containers.find((c: any) => String(c.id) === String(es.container_id))
            const otherIsArchive = otherContainer?.is_archived || otherContainer?.status === 'archived' || otherContainer?.isArchived

            if (!otherIsArchive) {
              // Move: update that existing row to the new container_id
              try {
                const updatePayload: any = {
                  container_id: targetContainerId,
                  last_updated: new Date().toISOString()
                }
                const { data: updData, error: updErr } = await supabase
                  .from('samples')
                  .update(updatePayload)
                  .eq('id', es.id)
                  .select('*')

                if (updErr) {
                  console.warn('Failed to move existing sample row id=', es.id, 'err=', updErr)
                  // if move failed, record error but don't stop processing other samples
                  results.push({ sample_id: sample.sample_id, success: false, error: updErr })
                } else {
                  // moved successfully; mark as moved and skip insertion for this sample
                  results.push({ sample_id: sample.sample_id, success: true, action: 'moved', from_container_id: es.container_id, to_container_id: targetContainerId, data: updData })
                  moved = true
                }
              } catch (e) {
                console.error('Exception moving sample id=', es.id, e)
                results.push({ sample_id: sample.sample_id, success: false, error: String(e) })
              }
            }
          }
        }

        // If there is already an existing row in the target container, prefer updating it:
        const existingInThisContainer = (existingSamples || []).find((s: any) => String(s.container_id) === String(targetContainerId))
        if (!moved) {
          if (existingInThisContainer && existingInThisContainer.id) {
            // We want to upsert into that existing row (so include id to update)
            sample.id = existingInThisContainer.id
          }
          // Defer final upsert/insert of this sample to the batched stage
          toUpsert.push(sample)
        } else {
          // If moved we don't also upsert — already updated row above. continue
        }
      } // end per-sample processing

      // Now perform efficient bulk upsert for remaining samples (if any)
      if (toUpsert.length > 0) {
        // Try preferred bulk upsert with ON CONFLICT
        try {
          const upsertRes = await supabase.from('samples').upsert(toUpsert, { onConflict: ['sample_id'] }).select()
          if (upsertRes.error) {
            const err = upsertRes.error
            const message = String(err?.message || '')
            if (err?.code === '42P10' || message.includes('ON CONFLICT')) {
              console.warn('Bulk upsert ON CONFLICT failed, falling back to per-sample update/insert', err)
              // Fall through to fallback
            } else {
              console.error('Bulk upsert failed:', err)
              // mark all as failed
              for (const s of toUpsert) results.push({ sample_id: s.sample_id, success: false, error: err })
              return json({ success: false, results }, 500)
            }
          } else {
            // Success: push results for these upserted rows
            const dataArray = Array.isArray(upsertRes.data) ? upsertRes.data : [upsertRes.data]
            for (const row of dataArray) {
              results.push({ sample_id: row.sample_id, success: true, kind: 'upsert', data: row })
            }
          }
        } catch (e) {
          console.warn('Bulk upsert threw, falling back:', e)
        }
      }

      // If any items still not covered (i.e., bulk upsert didn't succeed), do per-sample fallback update->insert
      // Find which sample_ids are missing in results
      const handledIds = new Set(results.map(r => r.sample_id))
      const pending = toUpsert.filter(s => !handledIds.has(s.sample_id))

      for (const s of pending) {
        try {
          const updateRes = await supabase.from('samples').update(s).eq('sample_id', s.sample_id).select('*')
          if (updateRes.error) {
            console.warn('Fallback update error for', s.sample_id, updateRes.error)
            // try insert
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
    } // end POST /samples

    // Not found
    return json({ error: 'Not found' }, 404)
  } catch (err) {
    console.error('Function handler error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})
