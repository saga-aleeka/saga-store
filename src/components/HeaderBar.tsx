import React, {useEffect, useRef, useState} from 'react'

type Props = { route?: string, user?: any, onSignOut?: () => void, isAdmin?: boolean, onExitAdmin?: () => void, containersCount?: number, archivedCount?: number, samplesCount?: number, searchQuery?: string, onSearchChange?: (query: string) => void }

export default function HeaderBar({route = window.location.hash || '#/containers', user, onSignOut, isAdmin, onExitAdmin, containersCount = 0, archivedCount = 0, samplesCount = 0, searchQuery = '', onSearchChange}: Props){
  const [menuOpen, setMenuOpen] = useState(false)
  const [tabsOpen, setTabsOpen] = useState(false)
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
                    <button className="dropdown-item" onClick={() => navigate('#/rnd')}>R&amp;D</button>
                    <button className="dropdown-item" onClick={() => navigate('#/cold-storage')}>Storage Units</button>
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
                  placeholder={route === '#/samples' ? 'Search samples by ID, container, storage path, or position... (separate multiple terms with comma)' : 'Search containers by ID, name, rack, or storage path... (separate multiple terms with comma)'}
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
    </header>
  )
}
