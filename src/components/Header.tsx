// Removed duplicate implementation of Header
// import removed — React and hooks are already imported later to avoid duplicate identifier

// Removed duplicate type definition

// Removed duplicate implementation of Header
import React, {useEffect, useRef, useState} from 'react'

type Props = { route?: string, user?: any, onSignOut?: () => void }

export default function Header({route = window.location.hash || '#/containers', user, onSignOut}: Props){
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
          <div className="text-2xl font-extrabold tracking-tight">SAGA</div>
          <div>
            <h1 className="text-lg font-semibold">SAGA Storage System</h1>
            <div className="text-sm text-gray-500">{user ? `Signed in: ${user.initials}${user.name ? ' • ' + user.name : ''}` : 'Not signed in'}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <button className="btn ghost" onClick={() => navigate('#/settings')}>Settings</button>
            <button className="btn" onClick={() => navigate('#/new')}>New</button>
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
                  <button className="dropdown-item" onClick={() => navigate('#/profile')}>Profile</button>
                  <button className="dropdown-item" onClick={() => navigate('#/help')}>Help</button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 tabs" role="tablist">
        <button className={(route === '#/containers' ? 'tab active' : 'tab')} onClick={() => navigate('#/containers')}>Containers <span className="ml-2 badge">1</span></button>
        <button className={(route === '#/archive' ? 'tab active' : 'tab')} onClick={() => navigate('#/archive')}>Archive <span className="ml-2 badge">0</span></button>
        <button className={(route === '#/samples' ? 'tab active' : 'tab')} onClick={() => navigate('#/samples')}>Samples <span className="ml-2 badge">0</span></button>
      </div>

      <div className="search-row mt-3">
        <div className="search flex items-center gap-2 bg-gray-50 rounded px-3 py-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 19a8 8 0 100-16 8 8 0 000 16z" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 21l-4.35-4.35" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <input className="bg-transparent outline-none text-sm" placeholder="Search active containers by ID, name, or location..." />
        </div>
      </div>

    </header>
  )
}
