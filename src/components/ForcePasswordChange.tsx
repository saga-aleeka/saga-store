import React, { useState } from 'react'
import { apiFetch } from '../lib/api'
import { supabase } from '../lib/supabaseClient'
import {
  getPasswordRequirements,
  getPasswordStrength,
  isPasswordAccepted,
  validateNewPassword,
} from '../lib/passwordPolicy'

type Props = {
  user: any
  onComplete: (user: any) => void
  onSignOut: () => void
}

export default function ForcePasswordChange({ user, onComplete, onSignOut }: Props){
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requirements = getPasswordRequirements(password)
  const strength = getPasswordStrength(password)
  const accepted = isPasswordAccepted(password, confirmPassword)

  async function submit(e?: React.FormEvent){
    e?.preventDefault()

    const validationError = validateNewPassword(password, confirmPassword)
    if (validationError) {
      setError(validationError)
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await apiFetch('/api/change_password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ new_password: password }),
      })
      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        setError(payload?.message || 'Could not update your password. Please try again.')
        return
      }

      // Pull the refreshed session so the cleared flag is reflected locally.
      const { data } = await supabase.auth.refreshSession()
      const refreshed = data?.user

      onComplete({
        ...user,
        passwordSet: true,
        mustChangePassword: false,
        ...(refreshed ? { email: refreshed.email ?? user?.email } : {}),
      })
    } catch (err) {
      console.warn('password change failed', err)
      setError('Could not update your password. Please try again.')
    } finally {
      setSaving(false)
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
        width: 'min(460px, 100%)',
        background: 'var(--card)',
        border: '1px solid var(--border-soft)',
        borderRadius: 8,
        boxShadow: 'var(--shadow)',
        padding: 32,
      }}>
        <img src="/Foundation-Medicine.jpg" alt="Foundation Medicine" style={{ height: 56, width: 'auto', margin: '0 auto 16px', display: 'block' }} />

        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-1)' }}>Choose a permanent password</h1>
        <p className="muted" style={{ marginTop: 8, marginBottom: 20, fontSize: 14 }}>
          You signed in with a temporary password{user?.email ? ` for ${user.email}` : ''}. Set a permanent password to continue.
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
            New password
            <input
              name="new-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(null) }}
              disabled={saving}
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

          <div style={{
            border: '1px solid var(--border-soft)',
            borderRadius: 6,
            padding: 12,
            background: 'var(--card-soft)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Password strength</span>
              <span style={{
                color: strength.tone === 'strong' ? '#15803d' : strength.tone === 'medium' ? '#b45309' : '#b91c1c',
                fontWeight: 600,
              }}>
                {password ? strength.label : 'Enter a password'}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[0, 1, 2].map((index) => {
                const active = strength.score >= (index + 1) * 2 - 1
                const color = !password || !active
                  ? 'var(--border-soft)'
                  : strength.tone === 'strong' ? '#16a34a' : strength.tone === 'medium' ? '#f59e0b' : '#ef4444'
                return <div key={index} style={{ height: 6, borderRadius: 999, background: color }} />
              })}
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0 0', display: 'grid', gap: 4, fontSize: 13 }}>
              {requirements.map((requirement) => (
                <li key={requirement.key} style={{ color: requirement.met ? '#15803d' : 'var(--muted)' }}>
                  {requirement.met ? '✓' : '○'} {requirement.label}
                </li>
              ))}
              <li style={{ color: confirmPassword && password === confirmPassword ? '#15803d' : 'var(--muted)' }}>
                {confirmPassword && password === confirmPassword ? '✓' : '○'} Passwords match
              </li>
            </ul>
          </div>

          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
            Confirm password
            <input
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setError(null) }}
              disabled={saving}
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

          <button type="submit" className="btn" disabled={saving || !accepted} style={{ width: '100%' }}>
            {saving ? 'Saving…' : 'Save password and continue'}
          </button>

          <button
            type="button"
            onClick={onSignOut}
            disabled={saving}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--muted)',
              fontSize: 13,
              cursor: saving ? 'not-allowed' : 'pointer',
              padding: 4,
            }}
          >
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
