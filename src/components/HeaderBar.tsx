import React, {useEffect, useRef, useState} from 'react'
import { supabase } from '../lib/supabaseClient'

type Props = { route?: string, user?: any, onSignOut?: () => void, isAdmin?: boolean, onExitAdmin?: () => void, containersCount?: number, archivedCount?: number, samplesCount?: number, searchQuery?: string, onSearchChange?: (query: string) => void }

export default function HeaderBar({route = window.location.hash || '#/containers', user, onSignOut, isAdmin, onExitAdmin, containersCount = 0, archivedCount = 0, samplesCount = 0, searchQuery = '', onSearchChange}: Props){
  const [menuOpen, setMenuOpen] = useState(false)
  const [tabsOpen, setTabsOpen] = useState(false)
  const [showPasswordSetup, setShowPasswordSetup] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null)
  const promptedUserRef = useRef<string | null>(null)
  const canAccessAdmin = !!user
  const root = useRef<HTMLDivElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const tabsButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuDropdownRef = useRef<HTMLDivElement | null>(null)
  const tabsDropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const key = String(user?.email || user?.initials || '')
    if (!key || user?.passwordSet) return
    if (promptedUserRef.current === key) return
    promptedUserRef.current = key
    setShowPasswordSetup(true)
  }, [user])

  async function savePassword(){
    if (!newPassword || !confirmPassword) {
      setPasswordError('Enter and confirm your password')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    setSavingPassword(true)
    try {
      setPasswordError(null)
      setPasswordNotice(null)
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        data: { password_set: true }
      })

      if (error) {
        setPasswordError(error.message || 'Failed to update password')
        return
      }

      setPasswordNotice('Password saved. You can now use password or magic link.')
      setTimeout(() => {
        setShowPasswordSetup(false)
        setNewPassword('')
        setConfirmPassword('')
        setPasswordNotice(null)
      }, 1000)
    } catch (err) {
      console.warn('password update failed', err)
      setPasswordError('Failed to update password')
    }
    setSavingPassword(false)
  }

  useEffect(() => {
    function onDoc(e: MouseEvent){
      const target = e.target as Node
      if (menuDropdownRef.current && menuDropdownRef.current.contains(target)) return
      if (tabsDropdownRef.current && tabsDropdownRef.current.contains(target)) return
      if (menuButtonRef.current && menuButtonRef.current.contains(target)) return
      if (tabsButtonRef.current && tabsButtonRef.current.contains(target)) return
      setMenuOpen(false)
      setTabsOpen(false)
    }
    function onKey(e: KeyboardEvent){
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setTabsOpen(false)
      }
    }
    document.addEventListener('click', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('click', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

  const navigate = (path: string) => {
    if (window.location.hash !== path) window.location.hash = path
    setMenuOpen(false)
    setTabsOpen(false)
  }

  const showNewRack = route.startsWith('#/racks/')
  const newAction = showNewRack
    ? { label: 'New Rack', path: '#/new-rack' }
    : null

  return (
    <header className="topbar px-4 py-2" ref={root}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img src="/saga-logo.png" alt="SAGA Diagnostics" className="h-8 w-auto" />
          <div>
            <div className="text-sm text-gray-500">{user ? `Signed in: ${user.initials}${user.name ? ' • ' + user.name : ''}` : 'Not signed in'}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            {!isAdmin && (
              <>
                {newAction && (
                  <button className="btn" onClick={() => navigate(newAction.path)}>
                    {newAction.label}
                  </button>
                )}
              </>
            )}
            {isAdmin && (
              <button className="btn ghost" onClick={() => { onExitAdmin ? onExitAdmin() : navigate('#/containers') }}>Exit Admin</button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                <div className="px-2 py-1 rounded bg-gray-100 font-semibold">{user.initials}</div>
                <button className="btn ghost" onClick={() => { onSignOut?.() }}>Sign out</button>
              </div>
            )}

            {canAccessAdmin && (
              <div className="relative">
                <button ref={menuButtonRef} aria-label="menu" className="hamburger" onClick={() => setMenuOpen(v => !v)}>
                  <span />
                  <span />
                  <span />
                </button>

                {menuOpen && (
                  <div ref={menuDropdownRef} className="dropdown" role="menu">
                    <button className="dropdown-item" onClick={() => navigate('#/admin')}>Admin Dashboard</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {!isAdmin && (
        <>
          <div className="mt-3" style={{display: 'flex', alignItems: 'center'}}>
            <div className="tabs" role="tablist" style={{gap: 6, alignItems: 'center'}}>
              <button className={(route === '#/containers' ? 'tab active' : 'tab')} onClick={() => navigate('#/containers')} style={{padding: '6px 10px', fontSize: 13}}>Containers</button>
              <button className={(route === '#/samples' ? 'tab active' : 'tab')} onClick={() => navigate('#/samples')} style={{padding: '6px 10px', fontSize: 13}}>Samples</button>
              <button className={(route === '#/worklist' ? 'tab active' : 'tab')} onClick={() => navigate('#/worklist')} style={{padding: '6px 10px', fontSize: 13}}>Worklist</button>
              <div className="relative" style={{display: 'inline-flex'}}>
                <button
                  className="tab"
                  onClick={() => setTabsOpen(v => !v)}
                  aria-label="More tabs"
                  ref={tabsButtonRef}
                  style={{
                    padding: '6px 10px',
                    fontSize: 16,
                    lineHeight: 1
                  }}
                >
                  <span style={{fontWeight: 700}}>⋯</span>
                </button>

                {tabsOpen && (
                  <div ref={tabsDropdownRef} className="dropdown" role="menu" style={{minWidth: 180}}>
                    <button className="dropdown-item" onClick={() => navigate('#/rnd')}>R&amp;D Containers</button>
                    <button className="dropdown-item" onClick={() => navigate('#/rnd/samples')}>R&amp;D Samples</button>
                    <div style={{borderTop: '1px solid #e5e7eb', margin: '4px 0'}} />
                    <button className="dropdown-item" onClick={() => navigate('#/cold-storage')}>Storage Units</button>
                    <button className="dropdown-item" onClick={() => navigate('#/tags')}>Tags</button>
                    <button className="dropdown-item" onClick={() => navigate('#/archive')}>Archive</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {route !== '#/worklist' && !route.startsWith('#/containers/') && !route.startsWith('#/cold-storage') && !route.startsWith('#/racks/') && (
            <div className="search-row mt-3">
              <div className="search flex items-center gap-2 bg-gray-50 rounded px-3 py-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 19a8 8 0 100-16 8 8 0 000 16z" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 21l-4.35-4.35" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <input 
                  className="bg-transparent outline-none text-sm flex-1" 
                  placeholder={(route === '#/samples' || route === '#/rnd/samples') ? 'Search samples by ID, container, storage path, or position... (separate multiple terms with comma)' : 'Search containers by ID, name, rack, or storage path... (separate multiple terms with comma)'}
                  value={searchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange?.('')}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#64748b',
                      fontSize: 18,
                      padding: 0,
                      lineHeight: 1
                    }}
                    aria-label="Clear search"
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {showPasswordSetup && (
        <div className="fixed inset-0 flex items-center justify-center bg-[rgba(0,0,0,0.25)] z-50">
          <div className="bg-white p-6 rounded-lg w-[430px] max-w-[92%] shadow-md">
            <h3 className="m-0 mb-2 text-lg font-bold">Set Your Password</h3>
            <p className="text-sm text-gray-600 mt-0 mb-3">Magic link sign-in is enabled. Add a password if you want to sign in either way.</p>

            <div className="flex flex-col gap-2">
              <input
                aria-label="New password"
                type="password"
                placeholder="New password (min 8 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="px-3 py-2 rounded border border-gray-200 text-sm outline-none"
              />
              <input
                aria-label="Confirm password"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="px-3 py-2 rounded border border-gray-200 text-sm outline-none"
              />
              {passwordError && <div className="text-red-600 text-sm">{passwordError}</div>}
              {passwordNotice && <div className="text-green-700 text-sm">{passwordNotice}</div>}
            </div>

            <div className="flex gap-2 justify-end mt-4">
              <button
                className="btn ghost"
                onClick={() => setShowPasswordSetup(false)}
                disabled={savingPassword}
              >
                Skip for now
              </button>
              <button
                className="btn"
                onClick={savePassword}
                disabled={savingPassword}
              >
                {savingPassword ? 'Saving...' : 'Save password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
