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

export function toAppUser(user: any){
  const md = user?.user_metadata || {}
  const appMd = user?.app_metadata || {}
  const email = user?.email || null
  const roles = getUserRoles(user)
  return {
    initials: md.initials || md.preferred_initials || toInitials(email),
    name: md.full_name || md.name || email || 'User',
    email,
    roles,
    role: roles[0] || null,
    passwordSet: md.password_set === true || md.passwordSet === true,
    mustChangePassword: appMd.must_change_password === true,
  }
}

export default function LoginPage({ onSuccess }: { onSuccess: (user: any) => void }){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function doSignIn(e?: React.FormEvent){
    e?.preventDefault()
    if (!email.trim() || !password) return

    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError || !data?.session || !data?.user) {
        const raw = String(signInError?.message || '')
        setError(
          /invalid login credentials/i.test(raw)
            ? 'Incorrect email or password.'
            : raw || 'Sign-in failed. Please try again.'
        )
        setPassword('')
        return
      }

      const appUser = toAppUser(data.user)
      setToken(data.session.access_token)
      setUser(appUser)
      setPassword('')
      onSuccess(appUser)
    } catch (err) {
      console.warn('sign-in failed', err)
      setError('Sign-in failed. Please try again.')
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  async function sendPasswordSetupEmail(){
    if (!email.trim()) return

    setResetLoading(true)
    setError(null)
    setNotice(null)

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: window.location.origin }
      )

      if (resetError) {
        setError('Could not send a password setup email. Check your email address and try again.')
        return
      }

      setNotice('Password setup email sent. Check your inbox to continue.')
    } catch (err) {
      console.warn('password setup email failed', err)
      setError('Could not send a password setup email. Please try again.')
    } finally {
      setResetLoading(false)
    }
  }


  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-1)',
      padding: 24,
    }}>
      <div style={{
        width: 'min(420px, 100%)',
        background: 'var(--card)',
        border: '1px solid var(--border-soft)',
        borderRadius: 8,
        boxShadow: 'var(--shadow)',
        padding: 32,
        textAlign: 'center',
      }}>
        <img src="/Foundation-Medicine.jpg" alt="Foundation Medicine" style={{ height: 64, width: 'auto', margin: '0 auto 12px' }} />
        <h1 style={{
          margin: 0,
          marginBottom: 24,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#3d5166',
        }}>
          F1 Sample Storage
        </h1>

        <form onSubmit={doSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 12, textAlign: 'left' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
            Work email
            <input
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading || resetLoading}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-soft)',
                background: 'var(--bg-1)',
                color: 'var(--text-1)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </label>

          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || resetLoading}
              style={{
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-soft)',
                background: 'var(--bg-1)',
                color: 'var(--text-1)',
                fontSize: 14,
                outline: 'none',
              }}
            />
          </label>

          {error && (
            <div role="alert" style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              borderRadius: 6,
              padding: '10px 12px',
              fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {notice && (
            <div role="status" style={{
              background: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#166534',
              borderRadius: 6,
              padding: '10px 12px',
              fontSize: 13,
            }}>
              {notice}
            </div>
          )}

          <button
            type="submit"
            className="btn"
            disabled={loading || resetLoading || !email.trim() || !password}
            style={{ width: '100%', marginTop: 4 }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <button
            type="button"
            className="btn ghost"
            onClick={sendPasswordSetupEmail}
            disabled={loading || resetLoading || !email.trim()}
            style={{ width: '100%' }}
          >
            {resetLoading ? 'Sending password setup email…' : 'Set or reset password'}
          </button>
        </form>
      </div>
    </div>
  )
}
