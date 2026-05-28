import React, { useState } from 'react'
import { setToken, setUser } from '../lib/auth'
import { supabase } from '../lib/supabaseClient'
import { getUserRoles } from '../lib/roles'

function toInitials(email?: string | null){
  const local = String(email || '').split('@')[0] || ''
  const cleaned = local.replace(/[^A-Za-z0-9]/g, '')
  if (!cleaned) return 'USER'
  return cleaned.slice(0, 4).toUpperCase()
}

function toAppUser(user: any){
  const md = user?.user_metadata || {}
  const email = user?.email || null
  const roles = getUserRoles(user)
  return {
    initials: md.initials || md.preferred_initials || toInitials(email),
    name: md.full_name || md.name || email || 'User',
    email,
    roles,
    role: roles[0] || null,
    passwordSet: md.password_set === true || md.passwordSet === true,
  }
}

export default function LoginModal({ onSuccess }: { onSuccess: (user: any) => void }){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'magic' | 'password'>('magic')
  const [loading, setLoading] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function doSignIn(){
    if (!email || !password) return
    setLoading(true)
    try{
      setError(null)
      setNotice(null)

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError || !data?.session || !data?.user) {
        setError(signInError?.message || 'Authentication failed')
        return
      }

      const appUser = toAppUser(data.user)
      setToken(data.session.access_token)
      setUser(appUser)
      onSuccess(appUser)
      setPassword('')
    }catch(e){ console.warn(e); setError('Sign-in failed') }
    setLoading(false)
  }

  async function sendMagicLink(){
    if (!email) return
    setMagicLinkLoading(true)
    try{
      setError(null)
      setNotice(null)
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
        },
      })
      if (otpError) {
        if (/not found|signup is disabled|user/i.test(String(otpError.message || ''))) {
          setError('Account not found. Ask an admin to create your access first.')
          return
        }
        setError(otpError.message || 'Failed to send sign-in email')
        return
      }
      setNotice('Sign-in email sent. Check your email to continue.')
    }catch(e){
      console.warn(e)
      setError('Failed to send sign-in email')
    }
    setMagicLinkLoading(false)
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.06)]">
      <div className="bg-white p-7 rounded-lg w-[420px] max-w-[90%] shadow-md text-center">
        <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center text-lg">👤</div>
        <h2 className="m-0 mb-3 text-lg font-bold">SAGA Sample Storage</h2>

        <div className="mt-2 flex flex-col gap-2 items-stretch">
          <input
            aria-label="Enter your email"
            placeholder="Work email"
            value={email}
            onChange={(e)=> setEmail(e.target.value)}
            type="email"
            autoCapitalize="none"
            autoCorrect="off"
            onKeyDown={(e)=> {
              if (e.key !== 'Enter') return
              if (mode === 'password') doSignIn()
              else sendMagicLink()
            }}
            autoFocus
            className="px-3 py-2 rounded border border-gray-200 text-sm outline-none"
          />

          {mode === 'password' && (
            <input
              aria-label="Enter your password"
              placeholder="Password"
              value={password}
              onChange={(e)=> setPassword(e.target.value)}
              type="password"
              onKeyDown={(e)=> { if (e.key === 'Enter') doSignIn() }}
              className="px-3 py-2 rounded border border-gray-200 text-sm outline-none"
            />
          )}

          {error && <div className="text-red-600 text-sm mt-1">{error}</div>}
          {notice && <div className="text-green-700 text-sm mt-1">{notice}</div>}

          {mode === 'magic' && (
            <button
              className="px-4 py-2 rounded bg-gray-700 text-white font-semibold disabled:opacity-60"
              onClick={sendMagicLink}
              disabled={magicLinkLoading || email.trim() === ''}
            >
              {magicLinkLoading ? 'Sending email...' : 'Email me a sign-in link'}
            </button>
          )}

          {mode === 'password' && (
            <button
              className="px-4 py-2 rounded bg-gray-700 text-white font-semibold disabled:opacity-60"
              onClick={doSignIn}
              disabled={loading || email.trim() === '' || password.trim() === ''}
            >
              {loading ? 'Signing in...' : 'Sign in with password'}
            </button>
          )}

          <button
            className="px-4 py-2 rounded border border-gray-300 text-gray-700 font-semibold"
            onClick={() => {
              setError(null)
              setNotice(null)
              setMode((v) => (v === 'magic' ? 'password' : 'magic'))
            }}
            disabled={loading || magicLinkLoading}
          >
            {mode === 'magic' ? 'Use password instead' : 'Use sign-in email instead'}
          </button>
        </div>
      </div>
    </div>
  )
}
