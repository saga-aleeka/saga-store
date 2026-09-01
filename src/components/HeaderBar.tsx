import React, {useEffect, useRef, useState} from 'react'

type Props = { route?: string, user?: any, onSignOut?: () => void, isAdmin?: boolean, onExitAdmin?: () => void, containersCount?: number, archivedCount?: number, samplesCount?: number, searchQuery?: string, onSearchChange?: (query: string) => void }

type ThemePreference = 'system' | 'light' | 'dark'
const ADMIN_SECTIONS = ['import', 'worklist', 'audit', 'backups', 'users'] as const
const ADMIN_LAST_SECTION_KEY = 'saga_admin_last_section'

export default function HeaderBar({route = window.location.hash || '#/containers', user, onSignOut, isAdmin, onExitAdmin, containersCount = 0, archivedCount = 0, samplesCount = 0, searchQuery = '', onSearchChange, themePreference = 'system', resolvedTheme = 'light', onThemePreferenceChange}: Props & { themePreference?: ThemePreference, resolvedTheme?: 'light' | 'dark', onThemePreferenceChange?: (mode: ThemePreference) => void }){
  const [menuOpen, setMenuOpen] = useState(false)
  const [tabsOpen, setTabsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const canAccessAdmin = !!user
  const root = useRef<HTMLDivElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const tabsButtonRef = useRef<HTMLButtonElement | null>(null)
  const menuDropdownRef = useRef<HTMLDivElement | null>(null)
  const tabsDropdownRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent){
      const target = e.target as Node
      if (menuDropdownRef.current && menuDropdownRef.current.contains(target)) return
      if (tabsDropdownRef.current && tabsDropdownRef.current.contains(target)) return
      if (menuButtonRef.current && menuButtonRef.current.contains(target)) return
      if (tabsButtonRef.current && tabsButtonRef.current.contains(target)) return
      setMenuOpen(false)
      setTabsOpen(false)
      setSettingsOpen(false)
    }
    function onKey(e: KeyboardEvent){
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setTabsOpen(false)
        setSettingsOpen(false)
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
    setSettingsOpen(false)
  }

  const showNewRack = route.startsWith('#/racks/')
  const newAction = showNewRack
    ? { label: 'New Rack', path: '#/new-rack' }
    : null
  const limsUrl = String((import.meta as any).env?.VITE_LIMS_URL || 'https://sagabase-ht.sagadiagnostics.com/').trim()
  const isAdminRoute = route.startsWith('#/admin')
  const adminSection = route.startsWith('#/admin/') ? route.split('/')[2] : 'import'

  const getLastAdminSection = () => {
    try {
      const stored = String(localStorage.getItem(ADMIN_LAST_SECTION_KEY) || '').trim()
      return (ADMIN_SECTIONS as readonly string[]).includes(stored) ? stored : 'import'
    } catch {
      return 'import'
    }
  }

  useEffect(() => {
    if (!isAdminRoute) return
    if (!(ADMIN_SECTIONS as readonly string[]).includes(adminSection)) return
    try {
      localStorage.setItem(ADMIN_LAST_SECTION_KEY, adminSection)
    } catch {}
  }, [isAdminRoute, adminSection])

  return (
    <>
    <header className="topbar" ref={root} style={{
      background: 'var(--card)',
      borderBottom: '1px solid var(--border-soft)',
      padding: '0 24px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 32, height: 56 }}>

        {/* Logo */}
        <img src="/foundation-medicine-logo.png" alt="Foundation Medicine" style={{ height: 28, width: 'auto', flexShrink: 0 }} />

        {/* Nav links */}
        {!isAdminRoute && (
          <nav style={{ display: 'flex', alignItems: 'stretch', gap: 0, height: '100%' }} role="tablist">
            {([
              { label: 'Containers', path: '#/containers' },
              { label: 'Samples', path: '#/samples' },
              { label: 'Worklist', path: '#/worklist' },
            ] as const).map(({ label, path }) => {
              const active = route === path
              return (
                <button
                  key={path}
                  role="tab"
                  aria-selected={active}
                  onClick={() => navigate(path)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: active ? '2px solid var(--text-1)' : '2px solid transparent',
                    padding: '0 16px',
                    fontSize: 14,
                    fontWeight: active ? 700 : 400,
                    color: active ? 'var(--text-1)' : 'var(--muted)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                >
                  {label}
                </button>
              )
            })}

            {/* More dropdown */}
            <div className="relative" style={{ display: 'inline-flex', alignItems: 'stretch' }}>
              <button
                className="tab"
                onClick={() => setTabsOpen(v => !v)}
                aria-label="More"
                ref={tabsButtonRef}
                style={{
                  background: 'none',
                  border: 'none',
                  borderBottom: '2px solid transparent',
                  padding: '0 12px',
                  fontSize: 18,
                  color: 'var(--muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                ···
              </button>
              {tabsOpen && (
                <div ref={tabsDropdownRef} className="dropdown" role="menu" style={{ minWidth: 180, top: 52 }}>
                  <button className="dropdown-item" onClick={() => navigate('#/rnd')}>R&amp;D Containers</button>
                  <button className="dropdown-item" onClick={() => navigate('#/rnd/samples')}>R&amp;D Samples</button>
                  {limsUrl && (
                    <a className="dropdown-item" href={limsUrl} target="_blank" rel="noopener noreferrer">LIMS ↗</a>
                  )}
                  <div className="dropdown-divider" />
                  <button className="dropdown-item" onClick={() => navigate('#/cold-storage')}>Storage Units</button>
                  <button className="dropdown-item" onClick={() => navigate('#/tags')}>Tags</button>
                  <button className="dropdown-item" onClick={() => navigate('#/archive')}>Archive</button>
                </div>
              )}
            </div>
          </nav>
        )}

        {isAdminRoute && (
          <nav style={{ display: 'flex', alignItems: 'stretch', gap: 0, height: '100%' }} role="tablist">
            {[
              ['import', 'Mass Import'],
              ['worklist', 'Worklist'],
              ['audit', 'Audit Trail'],
              ['backups', 'Backups'],
              ...(canAccessAdmin ? [['users', 'Users']] : [])
            ].map(([key, label]) => {
              const active = adminSection === key
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => navigate(`#/admin/${key}`)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: active ? '2px solid var(--text-1)' : '2px solid transparent',
                    padding: '0 16px',
                    fontSize: 14,
                    fontWeight: active ? 700 : 400,
                    color: active ? 'var(--text-1)' : 'var(--muted)',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.15s, border-color 0.15s'
                  }}
                >
                  {label}
                </button>
              )
            })}
          </nav>
        )}

        {isAdminRoute && (
          <button className="btn ghost" onClick={() => { onExitAdmin ? onExitAdmin() : navigate('#/containers') }}>Exit Admin</button>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Search */}
        {!isAdminRoute && route !== '#/worklist' && !route.startsWith('#/containers/') && !route.startsWith('#/cold-storage') && !route.startsWith('#/racks/') && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            border: '1px solid var(--border-soft)',
            borderRadius: 4,
            background: 'var(--bg-1)',
            minWidth: 260,
            maxWidth: 380,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M11 19a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <input
              name="container-search"
              type="search"
              autoComplete="off"
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: 13, flex: 1, color: 'var(--text-1)' }}
              placeholder={(route === '#/samples' || route === '#/rnd/samples') ? 'Search samples…' : 'Search containers…'}
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => onSearchChange?.('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16, padding: 0, lineHeight: 1 }}>×</button>
            )}
          </div>
        )}

        {/* User + menu */}
        {user && (
          <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
            {user.initials}{user.name ? ` · ${user.name}` : ''}
          </span>
        )}
        {user && (
          <button className="btn ghost" onClick={() => onSignOut?.()}>Sign out</button>
        )}

        {canAccessAdmin && (
          <div className="relative">
            <button ref={menuButtonRef} aria-label="menu" className="hamburger" onClick={() => setMenuOpen(v => !v)}>
              <span /><span /><span />
            </button>
            {menuOpen && (
              <div ref={menuDropdownRef} className="dropdown" role="menu">
                <button className="dropdown-item" onClick={() => navigate(`#/admin/${getLastAdminSection()}`)}>Admin Dashboard</button>
                <div className="dropdown-divider" />
                <button className="dropdown-item" onClick={() => setSettingsOpen(v => !v)}>User Settings</button>
                {settingsOpen && (
                  <div className="dropdown-settings" role="group" aria-label="Theme settings">
                    <div className="dropdown-label">Theme</div>
                    <label className="theme-option">
                      <input type="radio" name="theme-preference" checked={themePreference === 'system'} onChange={() => onThemePreferenceChange?.('system')} />
                      <span>System ({resolvedTheme})</span>
                    </label>
                    <label className="theme-option">
                      <input type="radio" name="theme-preference" checked={themePreference === 'light'} onChange={() => onThemePreferenceChange?.('light')} />
                      <span>Light</span>
                    </label>
                    <label className="theme-option">
                      <input type="radio" name="theme-preference" checked={themePreference === 'dark'} onChange={() => onThemePreferenceChange?.('dark')} />
                      <span>Dark</span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  </>
  )
}
