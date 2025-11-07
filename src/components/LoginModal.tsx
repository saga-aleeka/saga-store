import React, { useState } from 'react'
import { getApiUrl } from '../lib/api'
import { setToken, setUser } from '../lib/auth'

export default function LoginModal({ onSuccess }: { onSuccess: (user: any) => void }){
  const [initials, setInitials] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function doSignIn(){
    if (!initials) return
    setLoading(true)
    try{
      setError(null)
      // First try to fetch authorized users directly (MSW will proxy to Supabase when configured)
      try{
        // Force same-origin internal API to avoid VITE_API_BASE pointing at Supabase
        const listRes = await fetch('/api/authorized_users')
        if (listRes.ok){
          const jl = await listRes.json().catch(() => ({}))
          const list = jl.data ?? jl ?? []
          const match = (list || []).find((u: any) => String(u.initials).toLowerCase() === initials.trim().toLowerCase())
          if (match){
            // use the token stored in the authorized_users table for client-side auth
            setToken(String(match.token))
            setUser({ initials: match.initials, name: match.name })
            onSuccess({ initials: match.initials, name: match.name })
            setInitials('')
            setLoading(false)
            return
          }
        }
      }catch(e){
        // ignore proxy errors and fall back to signin endpoint
        // eslint-disable-next-line no-console
        console.warn('authorized_users lookup failed, falling back to signin', e)
      }

      // Fallback to server-side signin endpoint (if present)
  const res = await fetch('/api/auth/signin', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ initials }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok){
        setError(j.error || 'Initials not recognized')
        return
      }
      setToken(j.token)
      setUser({ initials: j.initials, name: j.name })
      onSuccess({ initials: j.initials, name: j.name })
      setInitials('')
    }catch(e){ console.warn(e); setError('Sign-in failed') }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.06)]">
      <div className="bg-white p-7 rounded-lg w-[420px] max-w-[90%] shadow-md text-center">
        <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center text-lg">👤</div>
        <h2 className="m-0 mb-3 text-lg font-bold">SAGA Sample Storage</h2>

        <div className="mt-2 flex flex-col gap-2 items-stretch">
          <input
            aria-label="Enter your initials"
            placeholder="Enter your initials"
            value={initials}
            onChange={(e)=> setInitials(e.target.value)}
            onKeyDown={(e)=> { if (e.key === 'Enter') doSignIn() }}
            autoFocus
            className="px-3 py-2 rounded border border-gray-200 text-sm outline-none"
          />
          {error && <div className="text-red-600 text-sm mt-1">{error}</div>}

          <button
            className="px-4 py-2 rounded bg-gray-700 text-white font-semibold disabled:opacity-60"
            onClick={doSignIn}
            disabled={loading || initials.trim() === ''}
          >
            {loading ? 'Signing in…' : 'Start Using SAGA'}
          </button>
        </div>
      </div>
    </div>
  )
}
