import React, { useState } from 'react'
import { Button } from './ui/button'
import { fetchServerEndpoint, API_BASE_URL } from '../utils/supabase/database'

export default function ServerFunctionDiagnostics() {
  const [output, setOutput] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function runHealthCheck() {
    setLoading(true)
    setOutput(null)
    try {
      const resp = await fetchServerEndpoint('/health', { method: 'GET' })
      const text = await resp.text().catch(() => '[no body]')
      setOutput(`GET ${API_BASE_URL}/health -> ${resp.status} ${resp.statusText}\n${text}`)
    } catch (err: any) {
      setOutput(`GET ${API_BASE_URL}/health -> ERROR: ${err?.message || String(err)}`)
      console.debug('Health check error details:', err)
    } finally {
      setLoading(false)
    }
  }

  async function runSamplesPost() {
    setLoading(true)
    setOutput(null)
    try {
      // Try an OPTIONS preflight first to surface CORS issues explicitly
      try {
        const opts = await fetchServerEndpoint('/samples', { method: 'OPTIONS' })
        const optsText = await opts.text().catch(() => '[no body]')
        setOutput(prev => `${prev || ''}OPTIONS ${API_BASE_URL}/samples -> ${opts.status} ${opts.statusText}\n${optsText}\n`)
      } catch (preErr: any) {
        setOutput(prev => `${prev || ''}OPTIONS -> ERROR: ${preErr?.message || String(preErr)}\n`)
      }

      // Then attempt a POST with a minimal payload
      try {
        const resp = await fetchServerEndpoint('/samples', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sample: { sample_id: 'DIAG-TEST', container_id: 'diagnostic-container' } })
        })
        const body = await resp.text().catch(() => '[no body]')
        setOutput(prev => `${prev || ''}POST ${API_BASE_URL}/samples -> ${resp.status} ${resp.statusText}\n${body}`)
      } catch (postErr: any) {
        setOutput(prev => `${prev || ''}POST -> ERROR: ${postErr?.message || String(postErr)}`)
        console.debug('Samples POST error details:', postErr)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-2 border rounded bg-white">
      <div className="flex gap-2">
        <Button onClick={runHealthCheck} disabled={loading}>Run /health</Button>
        <Button onClick={runSamplesPost} disabled={loading}>Test /samples (OPTIONS + POST)</Button>
      </div>
      <pre className="mt-2 text-sm whitespace-pre-wrap">{output || 'No diagnostics run yet.'}</pre>
    </div>
  )
}
