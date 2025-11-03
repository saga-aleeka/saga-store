import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'
import { getApiUrl } from './lib/api'

async function init(){
  // start MSW in development for a mocked backend
  if ((import.meta as any).env?.DEV) {
    try {
      const { worker } = await import('./mocks/browser')
      await worker.start()
      console.log('MSW worker started')
      // rehydrate mock seeds from localStorage if present
      try{
        const raw = localStorage.getItem('mock_seeds')
        if (raw) {
          const seeds = JSON.parse(raw)
          // create containers first
          if (Array.isArray(seeds.boxes)){
            for (const b of seeds.boxes){
              try{
                await fetch(getApiUrl('/api/containers'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: b.boxName, name: b.boxName, location: b.location ?? 'Imported', layout: b.layout, total: b.cols ? (b.cols * (b.rows?.length || 0)) : 81 }) })
              }catch(e){ /* ignore */ }
            }
          }
          // import samples
          if (Array.isArray(seeds.items) && seeds.items.length){
            try{
              await fetch(getApiUrl('/api/import'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: seeds.items }) })
            }catch(e){ /* ignore */ }
          }
        }
      }catch(e){ console.warn('failed to rehydrate mock seeds', e) }
    } catch (e) {
      console.warn('MSW failed to start', e)
    }
  }

  createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}

init()
