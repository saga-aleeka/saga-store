import React from 'react'

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="logo">SS</div>
        <div>
          <h1 className="title">Saga Store</h1>
          <p className="subtitle">A minimal scaffold — ready for development</p>
        </div>
      </header>

      <section className="card">
        <h2 style={{margin:0, marginBottom:8}}>Quick actions</h2>
        <p className="muted" style={{marginTop:0}}>Use these to preview and test the app locally.</p>

        <div style={{display:'flex',gap:12,marginTop:12}}>
          <button className="btn" onClick={() => alert('Start the dev server: npm run dev')}>Open dev server</button>
          <button className="btn ghost" onClick={() => alert('Build: npm run build')}>Build</button>
        </div>
      </section>

      <section className="card">
        <h3 style={{marginTop:0}}>Sample preview</h3>
        <div style={{marginTop:12,display:'grid',gap:10}}>
          <div className="sample-row">
            <div className="sample-meta">
              <div>
                <div className="sample-id">ABC-123</div>
                <div className="sample-pos">Container: TEST-C-01 • Position: A1</div>
              </div>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn ghost" onClick={() => alert('Preview sample history')}>History</button>
              <button className="btn" onClick={() => alert('Move sample')}>Move</button>
            </div>
          </div>
        </div>

        <div className="footnote">Tip: To enable backend operations re-add your Supabase project and configure function secrets.</div>
      </section>
    </div>
  )
}
