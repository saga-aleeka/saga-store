import React, {useEffect, useState} from 'react'
import { getApiUrl, apiFetch } from '../lib/api'

// parser helpers
function parseGridText(raw: string){
  if (!raw || !raw.trim()) return { boxes: [], items: [] }

  // split into blocks separated by blank lines
  const rawLines = raw.split(/\r?\n/)
  const blocks: string[][] = []
  let cur: string[] = []
  for (const l of rawLines){
    if (l.trim() === ''){ if (cur.length) { blocks.push(cur); cur = [] } }
    else cur.push(l)
  }
  if (cur.length) blocks.push(cur)

  const boxes: any[] = []
  const items: any[] = []

  for (const b of blocks){
  // attempt to detect box name in first lines
  let boxName = 'BOX'
  let startIdx = 0
  // detectedLocation may be discovered on the Box Name line; declare early so we can assign it there
  let detectedLocation: string | null = null
    for (let i=0;i<Math.min(3,b.length);i++){
      const line = b[i]
      if (/Box Name[:]?/i.test(line)){
        // split line by commas or tabs to find the token after 'Box Name:'
        const parts = line.split(/\t|,|\s{2,}/).map(s=>s.trim()).filter(Boolean)
        // find index of token containing 'Box' or 'Box Name'
        const idx = parts.findIndex(p => /Box Name[:]?/i.test(p) || /Box[:]?/i.test(p))
        if (idx !== -1 && parts.length > idx+1) {
          boxName = parts[idx+1]
        } else {
          const m = line.split(':')
          boxName = (m[1] || m[0]).trim() || boxName
        }
        // try to detect a location token to the left of the Box Name token (comma-separated)
        if (idx > 0) {
          boxName = String(boxName)
          if (!detectedLocation && parts[idx-1]) detectedLocation = parts[idx-1].trim()
        }
        startIdx = i+1
        break
      }
      if (/^[A-Za-z0-9_\-]+\s*$/.test(line) && line.length < 40){ boxName = line.trim(); startIdx = i+1; break }
    }

    // try to find header containing column numbers (e.g., ",1,2,3" or "1 2 3 4")
    let headerIdx = startIdx
    for (let i=startIdx;i<Math.min(b.length,startIdx+4);i++){
      // normalize by removing leading commas/spaces so headers like ",1,2,3" are detected
      const normalized = b[i].replace(/^\s*,+\s*/, '')
      const tokens = normalized.split(/,|\t|\s{2,}/).map(s => s.trim()).filter(Boolean)
      // if the non-empty tokens are all numeric (1,2,3...) treat as header
      if (tokens.length > 0 && tokens.every(t => /^\d+$/.test(t))){ headerIdx = i; break }
      // fallback: also accept a loose pattern containing the digit '1'
      if (/\b1\b/.test(b[i]) || /(^|\s)1(\s|,|\t)/.test(b[i])){ headerIdx = i; break }
    }

  const gridLines = b.slice(headerIdx+1)
  const rows: any[] = []
  let cols = 0
  let detectedLayout: string | null = null
    // peek first few gridLines for a layout specification like 9x9 or 8x12 and possible location
    for (let gi=0; gi<Math.min(4, gridLines.length); gi++){
      const gline = gridLines[gi]
      const m = gline.match(/(\d+)\s*[xX]\s*(\d+)/)
      if (m) { detectedLayout = `${m[1]}x${m[2]}`; break }
      const locMatch = gline.match(/([A-Za-z0-9 _\/\-]+)\s*$/)
      if (locMatch && locMatch[1] && !detectedLocation) detectedLocation = locMatch[1].trim()
    }

    // parse each grid line but KEEP empty cells (do not filter out blanks)
    for (const line of gridLines){
      const nl = line.replace(/\t/g, ',')
      // Split but preserve empty fields: split on comma or tabs or 2+ spaces
      const rawParts = nl.split(/,|\t|\s{2,}/).map(p=> p.trim())
      // remove trailing/leading empty-only lines
      if (rawParts.every(p => p === '')) continue

      // If this row appears to be a numeric header (e.g., ",1,2,3" or "1 2 3"), skip it
      const nonEmptyTokens = rawParts.filter(p => p !== '')
      if (nonEmptyTokens.length > 0 && nonEmptyTokens.every(t => /^\d+$/.test(t))) {
        continue
      }

      let rowLabel = ''
      let cells: string[] = []
      if (rawParts.length === 0) continue
      // If first token looks like a single letter row label, treat it as label
  if (/^[A-Za-z]$/.test(rawParts[0])){ rowLabel = rawParts[0]; cells = rawParts.slice(1) }
      // If first token starts with a letter then comma (e.g., "A," or "A ") use its first char
      else if (/^[A-Za-z]/.test(rawParts[0])){ rowLabel = rawParts[0][0]; cells = rawParts.slice(1) }
      else {
        // no explicit row label; assign sequential letters
        rowLabel = String.fromCharCode(65 + rows.length)
        cells = rawParts
      }

      // update columns count (do not discard empty slots)
      cols = Math.max(cols, cells.length)
      rows.push({ row: rowLabel, cells })
    }

    // normalize row cell arrays to the same column count, padding with empty string for missing positions
    for (const r of rows){
      while (r.cells.length < cols) r.cells.push('')
    }

    // if layout wasn't provided, infer from rows x cols
    if (!detectedLayout){ detectedLayout = `${rows.length}x${cols}` }

    // attempt to determine a location if not detected earlier by looking left of 'Box Name' in the original block
    if (!detectedLocation){
      for (let i=0;i<Math.min(3,b.length);i++){
        const m = b[i].match(/(.+)\s+Box Name[:]?/i)
        if (m && m[1]){ detectedLocation = m[1].trim(); break }
      }
    }

    // build items from non-empty cells; blank cells are considered empty positions but do not create items
    for (let ri=0; ri<rows.length; ri++){
      const r = rows[ri]
      for (let ci=0; ci<cols; ci++){
        const cell = (r.cells[ci] ?? '').toString().trim()
        const pos = `${r.row}${ci+1}`
        if (cell && cell !== '-'){
          items.push({ sample_id: cell, container_name: boxName, position: pos })
        }
      }
    }

    boxes.push({ boxName, rows, cols, layout: detectedLayout, location: detectedLocation })
  }

  return { boxes, items }
}

const sampleGridExample = `Box Name: cfDNA_BOX_001
1,2,3,4,5,6,7,8,9
A, C00388cD010, C00395cD008, C00304cD005, C00402cD006, C0411cD006, C00144cD002, C00554cD002, C00405cD018, C00394cD008
B, C00552cD001, C00394cD008, C00394cD009, C00375cD006, C00403cD006, C00388cD014, C00397cD014, C00554cD002, C00394cD008
C, C00395cD004, C00385cD004, C00372cD014, C00394cD006, C00355cD002, C00398cD008, C00402cD018, C00411cD016, C00388cD008
`

function parseCSVText(raw:string, delim = ','){
  // RFC4180-like parser: handles quoted fields and double-quote escaping
  if (!raw) return []
  const rows: string[][] = []
  let curRow: string[] = []
  let curField = ''
  let inQuotes = false
  for (let i=0;i<raw.length;i++){
    const ch = raw[i]
    const next = raw[i+1]
    if (ch === '"'){
      if (inQuotes && next === '"'){
        // escaped quote
        curField += '"'
        i++
        continue
      }
      inQuotes = !inQuotes
      continue
    }
    if (!inQuotes){
      // check delimiter (could be multichar)
      if (raw.substr(i, delim.length) === delim){
        curRow.push(curField)
        curField = ''
        i += delim.length - 1
        continue
      }
      if (ch === '\n' || (ch === '\r' && raw[i+1] === '\n')){
        // end of row
        curRow.push(curField)
        rows.push(curRow)
        curRow = []
        curField = ''
        if (ch === '\r' && raw[i+1] === '\n') i++
        continue
      }
    }
    curField += ch
  }
  // push remaining
  if (curField.length || raw.endsWith(delim)) curRow.push(curField)
  if (curRow.length) rows.push(curRow)
  return rows.map(r => r.map(c => c.trim()))
}

function useFetch<T>(url: string){
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetch(getApiUrl(url)).then(r => r.json()).then(j => { if (mounted) { setData(j.data ?? j); setLoading(false) }}).catch(()=>{ if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [url])
  return { data, loading }
}

export default function AdminDashboard(){

  const [tab, setTab] = useState<'import'|'audit'|'backups'>('import')

  // import UI state
  const [pasteText, setPasteText] = useState('')
  const [parsed, setParsed] = useState<any | null>(null)
  const [parsingError, setParsingError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<{ total: number; done: number; failed: number }>({ total: 0, done: 0, failed: 0 })

  // CSV mode / mapping
  const [mode, setMode] = useState<'grid'|'csv'>('grid')
  const [delimiter, setDelimiter] = useState(',')
  const [hasHeader, setHasHeader] = useState(true)
  const [csvPreviewRows, setCsvPreviewRows] = useState<string[][]>([])
  const [csvMapping, setCsvMapping] = useState<{[col:number]: string}>({})
  // editable preview changes
  const [editableBoxes, setEditableBoxes] = useState<any[] | null>(null)

  const audits = useFetch<any[]>('/api/audit')
  const backups = useFetch<any[]>('/api/backups')

  async function doImport(){
    const payload = { items: [ { sample_id: 'S-NEW', container: 1 } ] }
    const res = await fetch(getApiUrl('/api/import'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) })
    return res.json()
  }

  async function doRestore(id: string){
    await fetch(getApiUrl('/api/backups/restore'), { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id }) })
    // refresh audits/backups by reloading the page-level resources
  }

  return (
    <div className="card">
      <h2>Admin Dashboard</h2>
      <div style={{display:'flex',gap:8,marginTop:12,marginBottom:12}}>
        <button className={tab==='import'? 'btn':'btn ghost'} onClick={() => setTab('import')}>Mass Import</button>
        <button className={tab==='audit'? 'btn':'btn ghost'} onClick={() => setTab('audit')}>Audit Trail</button>
        <button className={tab==='backups'? 'btn':'btn ghost'} onClick={() => setTab('backups')}>Backups</button>
      </div>

      {tab === 'import' && (
        <div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <p className="muted">Upload CSV or paste grid-style records (see example). The parser will extract boxes and sample positions.</p>
          </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 360px',gap:12,marginTop:12}}>
            <div>
              <div style={{display:'flex',gap:8,alignItems:'center',marginBottom:8}}>
                <label style={{display:'flex',alignItems:'center',gap:6}}><input type="radio" checked={mode==='grid'} onChange={()=> setMode('grid')} /> Grid parser</label>
                <label style={{display:'flex',alignItems:'center',gap:6}}><input type="radio" checked={mode==='csv'} onChange={()=> setMode('csv')} /> CSV parser</label>
                {mode === 'csv' && (
                  <div style={{display:'flex',gap:8,alignItems:'center',marginLeft:12}}>
                    <label style={{display:'flex',alignItems:'center',gap:6}}>Delimiter <input value={delimiter} onChange={(e)=> setDelimiter(e.target.value || ',')} style={{width:40}} /></label>
                    <label style={{display:'flex',alignItems:'center',gap:6}}><input type="checkbox" checked={hasHeader} onChange={(e)=> setHasHeader(e.target.checked)} /> Header row</label>
                  </div>
                )}
              </div>
              <label style={{display:'block',marginBottom:8}}>Paste spreadsheet grid (CSV or tab-separated)</label>
              <textarea value={pasteText} onChange={(e)=> setPasteText(e.target.value)} style={{width:'100%',height:220,fontFamily:'monospace'}} placeholder={`Paste CSV/grid here, or use the file upload to the right.`} />

              <div style={{display:'flex',gap:8,marginTop:8}}>
                <input id="fileupload" type="file" accept=".csv,.txt" onChange={async (e)=>{
                  const f = e.target.files && e.target.files[0]
                  if (!f) return
                  const txt = await f.text()
                  setPasteText(txt)
                }} />
                <button className="btn" onClick={() => {
                  // parse (grid or csv)
                  try{
                    if (mode === 'grid'){
                      const p = parseGridText(pasteText)
                      setParsed(p)
                      setParsingError(null)
                    } else {
                      const rows = parseCSVText(pasteText, delimiter)
                      setCsvPreviewRows(rows.slice(0, 10))
                      // initialize mapping if empty
                      if (rows.length > 0){
                        const cols = rows[0].length
                        const initial: any = {}
                        for (let i=0;i<cols;i++) initial[i] = csvMapping[i] || (hasHeader ? (rows[0][i] || '') : '')
                        setCsvMapping(initial)
                        setParsed({ csvRows: rows })
                        setParsingError(null)
                      } else {
                        setParsed(null)
                        setParsingError('No CSV rows found')
                      }
                    }
                  }catch(err:any){ setParsingError(String(err)); setParsed(null) }
                }}>Parse</button>
                <button className="btn ghost" onClick={() => { setPasteText(''); setParsed(null); setParsingError(null) }}>Clear</button>
              </div>

              {parsingError && <div style={{color:'var(--danger)',marginTop:8}}>{parsingError}</div>}

              {parsed && (
                <div style={{marginTop:12,border:'1px solid #eee',padding:8,borderRadius:6}}>
                  <div style={{fontWeight:700}}>Preview</div>
                  <div className="muted">Found {parsed.items.length} samples across {parsed.boxes.length} boxes</div>
                  <div style={{marginTop:8,maxHeight:220,overflow:'auto'}}>
                    {parsed.boxes.map((b:any)=> (
                      <div key={b.boxName} style={{marginTop:8}}>
                        <div style={{fontWeight:700}}>{b.boxName}</div>
                        <div className="muted">{b.rows.length} rows • {b.cols} columns</div>
                        <div style={{display:'grid',gridTemplateColumns:`repeat(${Math.max(1,b.cols)}, 1fr)`,gap:4,marginTop:6}}>
                                {b.rows.map((r:any)=> r.cells.map((c:any,ci:number)=> c ? <div key={b.boxName+''+r.row+ci} style={{padding:6,border:'1px solid #f0f0f0',fontSize:12}}>{r.row}{ci+1}: {c}</div> : <div key={b.boxName+''+r.row+ci} style={{padding:6,border:'1px solid #f9f9f9',fontSize:12,color:'#999'}}>—</div>))}
                              <div style={{marginTop:6,fontSize:12,color:'#444'}}>Layout: {b.layout ?? 'unknown'} • Location: {b.location ?? 'unknown'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {mode === 'csv' && parsed && parsed.csvRows && (
                <div style={{marginTop:12,border:'1px solid #eee',padding:8,borderRadius:6}}>
                  <div style={{fontWeight:700}}>CSV Preview</div>
                  <div className="muted">First {Math.min(10, parsed.csvRows.length)} rows</div>
                  <div style={{marginTop:8,overflow:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse'}}>
                      <thead>
                        <tr>
                          {(parsed.csvRows[0] || []).map((_:any,ci:number)=> (
                            <th key={ci} style={{borderBottom:'1px solid #eee',padding:6,textAlign:'left'}}>
                              <div style={{display:'flex',gap:6,alignItems:'center'}}>
                                <div style={{fontSize:12,color:'#666'}}>Col {ci+1}</div>
                                <select value={csvMapping[ci] ?? ''} onChange={(e)=> setCsvMapping((m)=> ({...m, [ci]: e.target.value}))}>
                                  <option value="">(unused)</option>
                                  <option value="sample_id">sample_id</option>
                                  <option value="container_id">container_id</option>
                                  <option value="position">position</option>
                                  <option value="owner">owner</option>
                                  <option value="collected_at">collected_at</option>
                                </select>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.csvRows.slice(0,10).map((r:any,ri:number)=> (
                          <tr key={ri}>
                            {r.map((c:any,ci:number)=> (
                              <td key={ci} style={{padding:6,borderBottom:'1px solid #fafafa'}}>{c}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {editableBoxes && (
                <div style={{marginTop:12,border:'1px solid #ddd',padding:8,borderRadius:6}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div style={{fontWeight:700}}>Edit Parsed Boxes</div>
                    <div>
                      <button className="btn ghost" onClick={() => setEditableBoxes(null)}>Close</button>
                    </div>
                  </div>
                  <div style={{marginTop:8,display:'grid',gap:8}}>
                    {editableBoxes.map((b:any,bi:number)=> (
                      <div key={bi} style={{border:'1px solid #f5f5f5',padding:8,borderRadius:6}}>
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          <label style={{width:120}}>Container ID</label>
                          <input value={b.boxName} onChange={(e)=> setEditableBoxes((prev:any)=> { const copy = [...prev]; copy[bi].boxName = e.target.value; return copy })} />
                        </div>
                        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
                          <label style={{width:120}}>Location</label>
                          <input value={b.location ?? ''} onChange={(e)=> setEditableBoxes((prev:any)=> { const copy = [...prev]; copy[bi].location = e.target.value; return copy })} />
                        </div>
                        <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
                          <label style={{width:120}}>Layout</label>
                          <input value={b.layout ?? ''} onChange={(e)=> setEditableBoxes((prev:any)=> { const copy = [...prev]; copy[bi].layout = e.target.value; return copy })} />
                          <label style={{display:'flex',alignItems:'center',gap:6,marginLeft:12}}><input type="checkbox" checked={!!b.include} onChange={(e)=> setEditableBoxes((prev:any)=> { const copy = [...prev]; copy[bi].include = e.target.checked; return copy })} /> Include</label>
                        </div>
                      </div>
                    ))}

                    <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
                      <button className="btn" onClick={() => {
                        // apply edits: update parsed.boxes and parsed.items to reflect new container ids
                        const newBoxes = editableBoxes.map((bb:any)=> ({ boxName: bb.boxName, rows: bb.rows, cols: bb.cols, layout: bb.layout, location: bb.location }))
                        // remap items container_name according to parsed index
                        const newItems = parsed.items.map((it:any) => {
                          const mappedBox = editableBoxes.find((bb:any)=> String(bb.boxName) === String(it.container_name) || bb.rows.find((r:any)=> r.cells.includes(it.sample_id)))
                          if (mappedBox) return { ...it, container_name: mappedBox.boxName }
                          return it
                        })
                        setParsed({ ...parsed, boxes: newBoxes, items: newItems })
                        setEditableBoxes(null)
                      }}>Apply changes</button>
                      <button className="btn ghost" onClick={() => setEditableBoxes(null)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div style={{fontWeight:700}}>Import actions</div>
                <div className="muted">Mock only</div>
              </div>

              <div style={{marginTop:12,display:'grid',gap:8}}>
                <button className="btn" disabled={!parsed || importing} onClick={async () => {
                  if (!parsed) return
                  setImporting(true)
                  setImportProgress({ total: parsed.items ? parsed.items.length : 0, done: 0, failed: 0 })
                  try{
                    // ensure containers exist (create with verbatim ids)
                    const existingRes = await apiFetch('/api/containers')
                    const existingJson = await existingRes.json()
                    const existing = existingJson.data ?? existingJson
                    const boxes = Array.from(new Set(parsed.items.map((it:any)=> it.container_name)))
                    for (const box of boxes){
                      const exists = existing.find((c:any) => String(c.id) === String(box))
                      if (!exists){
                        // try to find metadata from parsed.boxes
                        const meta = (parsed.boxes || []).find((bb:any) => String(bb.boxName) === String(box)) || {}
                        const loc = meta.location ?? 'Imported'
                        const layout = meta.layout ?? undefined
                        await apiFetch('/api/containers', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: box, name: box, location: loc, total: 81, layout }) })
                      }
                    }

                    // persist seeds to localStorage so reloads can rehydrate mocks
                    try{
                      const seeds = { boxes: parsed.boxes, items: parsed.items }
                      localStorage.setItem('mock_seeds', JSON.stringify(seeds))
                    }catch(e){ console.warn('failed to persist seeds', e) }

                    // import items one-by-one to provide progress
                    const items = parsed.items || []
                    let done = 0, failed = 0
                    for (const it of items){
                      try{
                        await apiFetch('/api/import', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ items: [it] }) })
                        done++
                        setImportProgress(p => ({ ...p, done }))
                      }catch(e){ console.warn('item import failed', e); failed++; setImportProgress(p => ({ ...p, failed })) }
                    }
                    alert('Imported ' + done + ' items' + (failed ? ('; failed: ' + failed) : ''))
                    setParsed(null)
                    setPasteText('')
                  }catch(e){ console.warn(e); alert('Import failed') }
                  setImporting(false)
                }}>{importing ? 'Importing…' : 'Import parsed items'}</button>

                <button className="btn ghost" onClick={() => {
                  // quick demo load: populate pasteText with a sample from the attachments layout
                  setPasteText(sampleGridExample)
                }}>Load example grid</button>

                <div style={{fontSize:12,color:'#666'}}>
                  Tip: paste the grid for a box (rows A..I, columns 1..N). The parser will extract non-empty cells as samples and assign positions like A1, B2.
                </div>
              </div>
            </div>
          </div>
          {importing && (
            <div style={{marginTop:12}}>
              <div style={{fontWeight:700}}>Import progress</div>
              <div style={{marginTop:6}}>
                <div style={{height:10,background:'#eee',borderRadius:6,overflow:'hidden'}}>
                  <div style={{height:'100%',background:'#4caf50',width: `${importProgress.total ? Math.round((importProgress.done/importProgress.total)*100) : 0}%`}} />
                </div>
                <div className="muted" style={{marginTop:6}}>{importProgress.done}/{importProgress.total} imported • {importProgress.failed} failed</div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'audit' && (
        <div>
          <p className="muted">Recent audit events</p>
          <div style={{marginTop:12}}>
            {audits.loading && <div className="muted">Loading...</div>}
            {!audits.loading && audits.data && audits.data.length === 0 && <div className="muted">No audit events</div>}
            {!audits.loading && audits.data && audits.data.map((a:any) => (
              <div key={a.id} className="sample-row" style={{marginTop:8}}>
                <div>
                  <div style={{fontWeight:700}}>{a.type.toUpperCase()} — {a.target}</div>
                  <div className="muted">{a.msg}</div>
                </div>
                <div className="muted">{new Date(a.at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'backups' && (
        <div>
          <p className="muted">Backups</p>
          <div style={{marginTop:12}}>
            {backups.loading && <div className="muted">Loading...</div>}
            {!backups.loading && backups.data && backups.data.map((b:any) => (
              <div key={b.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginTop:8}}>
                <div>
                  <div style={{fontWeight:700}}>{b.id}</div>
                  <div className="muted">{b.created_at} • {b.size}</div>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button className="btn ghost" onClick={() => navigator.clipboard?.writeText(b.id)}>Copy</button>
                  <button className="btn" onClick={() => doRestore(b.id)}>Restore</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
