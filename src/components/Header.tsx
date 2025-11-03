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
    <header className="topbar" ref={root}>
      <div className="top-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <div className="brand" style={{display:'flex',alignItems:'center',gap:14}}>
          <div className="logo">SAGA</div>
          <div>
            <h1 className="title">SAGA Storage System</h1>
            <div className="tagline">{user ? `Signed in: ${user.initials}${user.name ? ' • ' + user.name : ''}` : 'Not signed in'}</div>
          </div>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{display:'flex',gap:8}}>
            <button className="btn ghost" onClick={() => navigate('#/settings')}>Settings</button>
            <button className="btn" onClick={() => navigate('#/new')}>New</button>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {user && (
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{padding:'6px 8px',borderRadius:6,background:'#f3f4f6',fontWeight:700}}>{user.initials}</div>
                <button className="btn ghost" onClick={() => { onSignOut?.() }}>Sign out</button>
              </div>
            )}

            <div className="hamburger-wrap" style={{position:'relative'}}>
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

      <div style={{marginTop:12}} className="tabs" role="tablist">
        <button className={(route === '#/containers' ? 'tab active' : 'tab')} onClick={() => navigate('#/containers')}>Containers <span style={{marginLeft:8}} className="badge">1</span></button>
        <button className={(route === '#/archive' ? 'tab active' : 'tab')} onClick={() => navigate('#/archive')}>Archive <span style={{marginLeft:8}} className="badge">0</span></button>
        <button className={(route === '#/samples' ? 'tab active' : 'tab')} onClick={() => navigate('#/samples')}>Samples <span style={{marginLeft:8}} className="badge">0</span></button>
      </div>

      <div className="search-row">
        <div className="search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 19a8 8 0 100-16 8 8 0 000 16z" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 21l-4.35-4.35" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <input placeholder="Search active containers by ID, name, or location..." />
        </div>
      </div>
    </header>
  )
}
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
    <header className="topbar" ref={root}>
      <div className="top-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <div className="brand" style={{display:'flex',alignItems:'center',gap:14}}>
          <div className="logo">SAGA</div>
          <div>
            <h1 className="title">SAGA Storage System</h1>
            <div className="tagline">{user ? `Signed in: ${user.initials}${user.name ? ' • ' + user.name : ''}` : 'Not signed in'}</div>
          </div>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{display:'flex',gap:8}}>
            <button className="btn ghost" onClick={() => navigate('#/settings')}>Settings</button>
            <button className="btn" onClick={() => navigate('#/new')}>New</button>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {user && (
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{padding:'6px 8px',borderRadius:6,background:'#f3f4f6',fontWeight:700}}>{user.initials}</div>
                <button className="btn ghost" onClick={() => { onSignOut?.() }}>Sign out</button>
              </div>
            )}

            <div className="hamburger-wrap" style={{position:'relative'}}>
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

      <div style={{marginTop:12}} className="tabs" role="tablist">
        <button className={(route === '#/containers' ? 'tab active' : 'tab')} onClick={() => navigate('#/containers')}>Containers <span style={{marginLeft:8}} className="badge">1</span></button>
        <button className={(route === '#/archive' ? 'tab active' : 'tab')} onClick={() => navigate('#/archive')}>Archive <span style={{marginLeft:8}} className="badge">0</span></button>
        <button className={(route === '#/samples' ? 'tab active' : 'tab')} onClick={() => navigate('#/samples')}>Samples <span style={{marginLeft:8}} className="badge">0</span></button>
      </div>

      <div className="search-row">
        <div className="search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 19a8 8 0 100-16 8 8 0 000 16z" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 21l-4.35-4.35" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <input placeholder="Search active containers by ID, name, or location..." />
        </div>
      </div>
    </header>
  )
}
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
    <header className="topbar" ref={root}>
      <div className="top-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
        <div className="brand" style={{display:'flex',alignItems:'center',gap:14}}>
          <div className="logo">SAGA</div>
          <div>
            <h1 className="title">SAGA Storage System</h1>
            <div className="tagline">{user ? `Signed in: ${user.initials}${user.name ? ' • ' + user.name : ''}` : 'Not signed in'}</div>
          </div>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{display:'flex',gap:8}}>
            <button className="btn ghost" onClick={() => navigate('#/settings')}>Settings</button>
            <button className="btn" onClick={() => navigate('#/new')}>New</button>
          </div>

          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {user && (
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{padding:'6px 8px',borderRadius:6,background:'#f3f4f6',fontWeight:700}}>{user.initials}</div>
                <button className="btn ghost" onClick={() => { onSignOut?.() }}>Sign out</button>
              </div>
            )}

            <div className="hamburger-wrap" style={{position:'relative'}}>
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

      <div style={{marginTop:12}} className="tabs" role="tablist">
        <button className={(route === '#/containers' ? 'tab active' : 'tab')} onClick={() => navigate('#/containers')}>Containers <span style={{marginLeft:8}} className="badge">1</span></button>
        <button className={(route === '#/archive' ? 'tab active' : 'tab')} onClick={() => navigate('#/archive')}>Archive <span style={{marginLeft:8}} className="badge">0</span></button>
        <button className={(route === '#/samples' ? 'tab active' : 'tab')} onClick={() => navigate('#/samples')}>Samples <span style={{marginLeft:8}} className="badge">0</span></button>
      </div>

      <div className="search-row">
        <div className="search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M11 19a8 8 0 100-16 8 8 0 000 16z" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 21l-4.35-4.35" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <input placeholder="Search active containers by ID, name, or location..." />
        </div>
      </div>

    </header>
  )
}
