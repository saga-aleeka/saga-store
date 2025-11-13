import React, {useEffect, useRef, useState} from 'react'

type Props = { route?: string, user?: any, onSignOut?: () => void, isAdmin?: boolean, onExitAdmin?: () => void, containersCount?: number, archivedCount?: number, samplesCount?: number }

export default function HeaderBar({route = window.location.hash || '#/containers', user, onSignOut, isAdmin, onExitAdmin, containersCount = 0, archivedCount = 0, samplesCount = 0}: Props){
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent){
      if (!root.current) return
      if (!root.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  const navigate = (path: string) => {
    if (window.location.hash !== path) window.location.hash = path
    setOpen(false)
  }

  return (
    <header className="topbar bg-white shadow-sm px-4 py-3" ref={root}>
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
                <button className="btn" onClick={() => navigate('#/new')}>New</button>
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
              <button aria-label="menu" className="hamburger" onClick={() => setOpen(v => !v)}>
                <span />
                <span />
                <span />
              </button>

              {open && (
                <div className="dropdown" role="menu">
                  <button className="dropdown-item" onClick={() => navigate('#/admin')}>Admin Dashboard</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {!isAdmin && (
        <>
          <div className="mt-3 tabs" role="tablist">
            <button className={(route === '#/containers' ? 'tab active' : 'tab')} onClick={() => navigate('#/containers')}>Containers</button>
            <button className={(route === '#/archive' ? 'tab active' : 'tab')} onClick={() => navigate('#/archive')}>Archive</button>
            <button className={(route === '#/samples' ? 'tab active' : 'tab')} onClick={() => navigate('#/samples')}>Samples</button>
            <button className={(route === '#/worklist' ? 'tab active' : 'tab')} onClick={() => navigate('#/worklist')}>Worklist</button>
          </div>

          <div className="search-row mt-3">
            <div className="search flex items-center gap-2 bg-gray-50 rounded px-3 py-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 19a8 8 0 100-16 8 8 0 000 16z" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 21l-4.35-4.35" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <input className="bg-transparent outline-none text-sm" placeholder="Search active containers by ID, name, or location..." />
            </div>
          </div>
        </>
      )}
    </header>
  )
}
