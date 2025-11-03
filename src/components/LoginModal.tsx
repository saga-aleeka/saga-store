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
        const listRes = await fetch(getApiUrl('/api/authorized_users'))
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
      const res = await fetch(getApiUrl('/api/auth/signin'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ initials }) })
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
    <div style={{position:'fixed',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.06)'}}>
      <div style={{background:'#fff',padding:28,borderRadius:10,width:420,maxWidth:'90%',boxShadow:'0 6px 18px rgba(15,23,42,0.08)',textAlign:'center'}}>
        <div style={{height:48,width:48,margin:'0 auto 12px',borderRadius:24,background:'#f5f5f7',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>👤</div>
        <h2 style={{margin:'0 0 14px',fontSize:18,fontWeight:700}}>SAGA Sample Storage</h2>

        <div style={{marginTop:6,display:'flex',flexDirection:'column',gap:10,alignItems:'stretch'}}>
          <input
            aria-label="Enter your initials"
            placeholder="Enter your initials"
            value={initials}
            onChange={(e)=> setInitials(e.target.value)}
            onKeyDown={(e)=> { if (e.key === 'Enter') doSignIn() }}
            autoFocus
            style={{padding:10,borderRadius:6,border:'1px solid #e6e6e9',fontSize:14}}
          />
          {error && <div style={{color:'#cc1f1a',fontSize:13,marginTop:6}}>{error}</div>}

          <button
            className="btn"
            onClick={doSignIn}
            disabled={loading || initials.trim() === ''}
            style={{padding:'10px 12px',borderRadius:6,background:'#6b6f76',color:'#fff',border:'none',fontWeight:700}}
          >
            {loading ? 'Signing in…' : 'Start Using SAGA'}
          </button>
        </div>
      </div>
    </div>
  )
}
