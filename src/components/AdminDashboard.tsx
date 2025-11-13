import React, {useEffect, useState} from 'react'
import { getApiUrl, apiFetch } from '../lib/api'
import { formatDateTime } from '../lib/dateUtils'

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
    let aborted = false
    setLoading(true)

    async function fetchData(){
      setLoading(true)
      try{
        const r = await fetch(getApiUrl(url))
        if (!r.ok && r.status === 404) {
          // Endpoint doesn't exist, return empty array
          if (mounted && !aborted) { setData([] as any); setLoading(false) }
          return
        }
        const j = await r.json()
        if (mounted && !aborted){ setData(j.data ?? j); setLoading(false) }
      }catch(err){ 
        console.warn('Fetch error for', url, err)
        if (mounted && !aborted) { setData([] as any); setLoading(false) }
      }
    }

    fetchData()

    // allow external triggers to refresh (e.g., after create/update/delete)
    const handler = () => { fetchData() }
    window.addEventListener('authorized_users_updated', handler)

    return () => { mounted = false; aborted = true; window.removeEventListener('authorized_users_updated', handler) }
  }, [url])
  return { data, loading }
}

export default function AdminDashboard(){

  const [tab, setTab] = useState<'import'|'audit'|'backups'|'users'>('import')

  // fetch authorized users (server-side endpoint will use service role key in production)
  const authUsers = useFetch<any[]>('/api/admin_users')
  const [showAdd, setShowAdd] = useState(false)
  const [newInitials, setNewInitials] = useState('')
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  // auto-clear notices after a short delay
  React.useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<any | null>(null)

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
        <button className={tab==='users'? 'btn':'btn ghost'} onClick={() => setTab('users')}>Authorized Users</button>
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
              </div>

              <div style={{marginTop:12,display:'grid',gap:8}}>
                <button className="btn" disabled={!parsed || importing} onClick={async () => {
                  if (!parsed) return
                  setImporting(true)
                  setImportProgress({ total: parsed.items ? parsed.items.length : 0, done: 0, failed: 0 })
                  try{
                    // Import via Supabase directly
                    const { supabase } = await import('../lib/api')
                    
                    // Helper function to extract sample type from container name
                    const extractSampleType = (name: string): string => {
                      const nameUpper = name.toUpperCase()
                      if (nameUpper.includes('CFDNA')) return 'cfDNA Tubes'
                      if (nameUpper.includes('DP') && nameUpper.includes('POOL')) return 'DP Pools'
                      if (nameUpper.includes('DTC')) return 'DTC Tubes'
                      if (nameUpper.includes('PA') && nameUpper.includes('POOL')) return 'PA Pools'
                      if (nameUpper.includes('MNC')) return 'MNC Tubes'
                      if (nameUpper.includes('PLASMA')) return 'Plasma Tubes'
                      if (nameUpper.includes('BC')) return 'BC Tubes'
                      if (nameUpper.includes('IDT') && nameUpper.includes('PLATE')) return 'IDT Plates'
                      return 'Sample Type'
                    }
                    
                    // Get existing containers
                    const { data: existing } = await supabase.from('containers').select('id, name')
                    const existingMap = new Map((existing || []).map((c: any) => [String(c.name), c]))
                    
                    // Get unique box names from parsed items
                    const boxes = Array.from(new Set(parsed.items.map((it:any)=> it.container_name)))
                    const containerMap = new Map()
                    
                    for (const boxName of boxes){
                      const exists = existingMap.get(String(boxName))
                      if (exists){
                        containerMap.set(boxName, exists.id)
                      } else {
                        // Create new container with parsed metadata and detected sample type
                        const meta = (parsed.boxes || []).find((bb:any) => String(bb.boxName) === String(boxName)) || {}
                        const location = meta.location ?? 'Imported'
                        const layout = meta.layout ?? '9x9'
                        const sampleType = extractSampleType(boxName)
                        
                        const { data: newContainer, error: createError } = await supabase
                          .from('containers')
                          .insert([{
                            name: boxName,
                            location: location,
                            layout: layout,
                            type: sampleType,
                            temperature: '-80°C',
                            used: 0,
                            total: 81,
                            archived: false,
                            training: false
                          }])
                          .select('id')
                          .single()
                        
                        if (createError) {
                          console.error('Failed to create container:', boxName, createError)
                          throw createError
                        }
                        containerMap.set(boxName, newContainer.id)
                      }
                    }

                    // Import samples using the samples_upsert_v1 RPC
                    const items = parsed.items || []
                    const samplesData = items.map((it: any) => ({
                      sample_id: it.sample_id,
                      container_id: containerMap.get(it.container_name),
                      position: it.position,
                      is_archived: false
                    }))
                    
                    console.log('Importing samples:', samplesData.length, 'samples')
                    console.log('Sample data preview:', samplesData.slice(0, 3))
                    
                    let done = 0, failed = 0
                    // Process in batches of 50 for better performance
                    const batchSize = 50
                    for (let i = 0; i < samplesData.length; i += batchSize) {
                      const batch = samplesData.slice(i, i + batchSize)
                      try {
                        // RPC expects jsonb array directly, not wrapped in object
                        const { data, error } = await supabase.rpc('samples_upsert_v1', { sample_json: batch })
                        if (error) {
                          console.error('RPC error:', error)
                          throw error
                        }
                        
                        // Check individual results
                        console.log('RPC response:', data)
                        if (data && Array.isArray(data)) {
                          const successCount = data.filter((r: any) => r.success).length
                          const failCount = data.filter((r: any) => !r.success).length
                          done += successCount
                          failed += failCount
                          
                          // Log failures with details
                          const failures = data.filter((r: any) => !r.success)
                          if (failures.length > 0) {
                            console.error('Sample import failures:', failures)
                            console.error('First failure detail:', JSON.stringify(failures[0], null, 2))
                            // Group by error type
                            const errorGroups = failures.reduce((acc: any, f: any) => {
                              const err = f.error || 'unknown'
                              acc[err] = (acc[err] || 0) + 1
                              return acc
                            }, {})
                            console.error('Error summary:', errorGroups)
                          }
                        } else {
                          done += batch.length
                        }
                        
                        setImportProgress(p => ({ ...p, done, failed }))
                      } catch(e) {
                        console.error('Batch import failed:', e)
                        failed += batch.length
                        setImportProgress(p => ({ ...p, failed }))
                      }
                    }
                    
                    alert('Imported ' + done + ' items' + (failed ? ('; failed: ' + failed) : ''))
                    setParsed(null)
                    setPasteText('')
                    
                    // Dispatch event to refresh container list
                    window.dispatchEvent(new Event('container-updated'))
                  }catch(e){ console.error('Import error:', e); alert('Import failed: ' + (e as Error).message) }
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
          <p className="muted">Comprehensive audit log of all container and sample changes</p>
          <div style={{marginTop:12}}>
            {audits.loading && <div className="muted">Loading...</div>}
            {!audits.loading && audits.data && audits.data.length === 0 && <div className="muted">No audit events</div>}
            {!audits.loading && audits.data && audits.data.map((a:any) => (
              <div key={a.id} className="sample-row" style={{marginTop:8,padding:12,background:'#f9fafb',borderRadius:6}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <span style={{
                      padding:'2px 8px',
                      background: a.entity_type === 'container' ? '#dbeafe' : '#fef3c7',
                      color: a.entity_type === 'container' ? '#1e40af' : '#92400e',
                      borderRadius:4,
                      fontSize:11,
                      fontWeight:600,
                      textTransform:'uppercase'
                    }}>
                      {a.entity_type}
                    </span>
                    <span style={{
                      padding:'2px 8px',
                      background: a.action === 'deleted' ? '#fee2e2' : 
                                 a.action === 'created' ? '#dcfce7' : 
                                 a.action === 'archived' ? '#fed7aa' : '#e5e7eb',
                      color: a.action === 'deleted' ? '#991b1b' : 
                            a.action === 'created' ? '#166534' : 
                            a.action === 'archived' ? '#9a3412' : '#374151',
                      borderRadius:4,
                      fontSize:11,
                      fontWeight:600,
                      textTransform:'uppercase'
                    }}>
                      {a.action}
                    </span>
                    {a.user_initials && (
                      <span style={{fontSize:12,color:'#6b7280'}}>
                        by <strong>{a.user_initials}</strong>{a.user_name ? ` (${a.user_name})` : ''}
                      </span>
                    )}
                  </div>
                  <div style={{fontWeight:600,fontSize:14,marginBottom:4}}>{a.description || a.entity_name}</div>
                  {a.entity_name && a.description && (
                    <div className="muted" style={{fontSize:12}}>Entity: {a.entity_name}</div>
                  )}
                  {a.metadata && (
                    <div className="muted" style={{fontSize:12,marginTop:4}}>
                      {a.metadata.location && `Location: ${a.metadata.location} • `}
                      {a.metadata.position && `Position: ${a.metadata.position} • `}
                      {a.metadata.layout && `Layout: ${a.metadata.layout} • `}
                      {a.metadata.samples_deleted > 0 && `Samples deleted: ${a.metadata.samples_deleted}`}
                    </div>
                  )}
                </div>
                <div className="muted" style={{fontSize:11,whiteSpace:'nowrap',alignSelf:'flex-start'}}>
                  {formatDateTime(a.created_at)}
                </div>
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
                  <div style={{fontWeight:700}}>{b.created_at}</div>
                  <div className="muted">{b.size}</div>
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

      {tab === 'users' && (
        <div>
          <p className="muted">Authorized users (from Supabase)</p>
          <div style={{marginTop:12}}>
            {authUsers.loading && <div className="muted">Loading...</div>}
            {!authUsers.loading && authUsers.data && authUsers.data.length === 0 && <div className="muted">No authorized users found</div>}

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:8,marginBottom:8}}>
              <div style={{display:'flex',gap:8}}>
                <button className="btn" onClick={() => setShowAdd(v => !v)}>{showAdd ? 'Cancel' : 'Add user'}</button>
                <AuthorizedUsersLink />
              </div>
              <div style={{fontSize:13,color:'#666'}}>Users: {authUsers.data ? authUsers.data.length : '—'}</div>
            </div>

            <div style={{marginBottom:12,display:'flex',gap:8,alignItems:'center'}}>
              <button className="btn ghost" onClick={async ()=>{
                setTestLoading(true)
                setTestResult(null)
                try{
                  const r = await apiFetch('/api/admin_users')
                  const status = r.status
                  const hdrs: Record<string,string> = {}
                  r.headers.forEach((v,k) => { hdrs[k] = v })
                  const text = await r.text()
                  let parsed: any = text
                  try{ parsed = JSON.parse(text) }catch(e){}
                  setTestResult({ status, headers: hdrs, body: parsed })
                }catch(e){ setTestResult({ error: String(e) }) }
                setTestLoading(false)
              }}>{testLoading ? 'Testing…' : 'Test connection'}</button>
              {testResult && (
                <div style={{flex:1}}>
                  <div style={{marginTop:6,fontSize:13,fontWeight:700}}>Test result</div>
                  <pre style={{background:'#f7f7fb',padding:8,borderRadius:6,whiteSpace:'pre-wrap',maxHeight:240,overflow:'auto'}}>{typeof testResult === 'string' ? testResult : JSON.stringify(testResult,null,2)}</pre>
                  <div style={{marginTop:6}}>
                    <button className="btn ghost" onClick={()=> navigator.clipboard?.writeText(typeof testResult === 'string' ? testResult : JSON.stringify(testResult,null,2))}>Copy JSON</button>
                  </div>
                </div>
              )}
            </div>

              {notice && (
                <div style={{padding:10,marginBottom:12,borderRadius:6,background: notice.type === 'success' ? '#e6ffed' : '#ffecec', border: notice.type === 'success' ? '1px solid #b7f2c9' : '1px solid #f5c6c6', color: notice.type === 'success' ? '#0b6b2b' : '#8a1b1b'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div>{notice.text}</div>
                    <button className="btn ghost" onClick={() => setNotice(null)}>Dismiss</button>
                  </div>
                </div>
              )}

              {showAdd && (
                <div style={{border:'1px solid #eee',padding:8,borderRadius:6,marginBottom:12}}>
                  <div style={{display:'flex',gap:8,alignItems:'center'}}>
                    <input placeholder="Initials" value={newInitials} onChange={(e)=> setNewInitials(e.target.value)} />
                    <input placeholder="Name (optional)" value={newName} onChange={(e)=> setNewName(e.target.value)} />
                    <button className="btn" onClick={async ()=>{
                      try{
                        await apiFetch('/api/admin_users', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ initials: newInitials, name: newName }) })
                        setNewInitials(''); setNewName(''); setShowAdd(false)
                        setNotice({ type: 'success', text: 'User created' })
                        window.dispatchEvent(new Event('authorized_users_updated'))
                      }catch(e){ console.warn('create user failed', e); setNotice({ type: 'error', text: 'Create failed' }) }
                    }}>Save</button>
                  </div>
                </div>
              )}

            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr style={{textAlign:'left',borderBottom:'1px solid #eee'}}>
                    <th style={{padding:8}}>Initials</th>
                    <th style={{padding:8}}>Name</th>
                    <th style={{padding:8}}>Created</th>
                    <th style={{padding:8,width:60}}> </th>
                  </tr>
                </thead>
                <tbody>
                  {!authUsers.loading && authUsers.data && authUsers.data.map((u:any) => (
                    <tr key={u.id} style={{borderBottom:'1px solid #fafafa'}}>
                      <td style={{padding:8,verticalAlign:'middle',fontWeight:700}}>{u.initials}</td>
                      <td style={{padding:8}}>{editingId === u.id ? (
                        <input value={editingName} onChange={(e)=> setEditingName(e.target.value)} />
                      ) : (u.name || '')}</td>
                      <td style={{padding:8}} className="muted">{u.created_at ?? u.createdAt ?? ''}</td>
                      <td style={{padding:8,verticalAlign:'middle'}}>
                        <div style={{position:'relative'}}>
                          <button className="btn ghost" onClick={(e)=>{
                            // toggle edit mode
                            if (editingId === u.id){ setEditingId(null); setEditingName('') }
                            else { setEditingId(u.id); setEditingName(u.name || '') }
                          }}>⋯</button>
                          {editingId === u.id && (
                            <div style={{position:'absolute',right:0,top:28,background:'#fff',border:'1px solid #eee',borderRadius:6,padding:8,zIndex:20,boxShadow:'0 4px 12px rgba(0,0,0,0.06)'}}>
                              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                                <button className="btn" onClick={async ()=>{
                                  try{
                                    await apiFetch('/api/admin_users', { method: 'PATCH', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: u.id, updates: { name: editingName } }) })
                                    setEditingId(null); setEditingName('')
                                    setNotice({ type: 'success', text: 'User updated' })
                                    window.dispatchEvent(new Event('authorized_users_updated'))
                                  }catch(e){ console.warn('update failed', e); setNotice({ type: 'error', text: 'Update failed' }) }
                                }}>Save</button>
                                <button className="btn ghost" onClick={()=> { setEditingId(null); setEditingName('') }}>Cancel</button>
                                <button className="btn" onClick={async ()=>{
                                  if (!confirm(`Delete user ${u.initials}? This cannot be undone.`)) return
                                  try{
                                    await apiFetch('/api/admin_users', { method: 'DELETE', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: u.id }) })
                                    setEditingId(null); setEditingName('')
                                    setNotice({ type: 'success', text: 'User deleted' })
                                    window.dispatchEvent(new Event('authorized_users_updated'))
                                  }catch(e){ console.warn('delete failed', e); setNotice({ type: 'error', text: 'Delete failed' }) }
                                }}>Delete</button>
                                {u.token && <button className="btn ghost" onClick={() => { navigator.clipboard?.writeText(String(u.token || '')) }}>Copy token</button>}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AuthorizedUsersLink(){
  const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL ?? (import.meta as any).VITE_SUPABASE_URL ?? ''
  let consoleUrl = ''
  if (SUPABASE_URL){
    try{
      const u = new URL(String(SUPABASE_URL))
      const projectRef = u.hostname.split('.')[0]
      consoleUrl = `https://app.supabase.com/project/${projectRef}/table/public/authorized_users`
    }catch(e){ console.warn('failed to build supabase console url', e) }
  }

  if (!consoleUrl) return (
    <div style={{fontSize:13,color:'#666'}}>Set <code>VITE_SUPABASE_URL</code> to enable opening the Supabase table editor.</div>
  )

  return (
    <>
      <a className="btn" href={consoleUrl} target="_blank" rel="noreferrer">Add new user (Open Supabase)</a>
      <div style={{fontSize:13,color:'#666',alignSelf:'center'}}>Opens Supabase table editor for <code>authorized_users</code></div>
    </>
  )
}
