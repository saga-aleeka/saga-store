// Backup endpoint - generates CSV backups and lists stored backups
const { createClient } = require('@supabase/supabase-js')

// Helper to generate CSV content
function generateCSV(containers: any[], samples: any[]): string {
  const lines: string[] = []
  
  // Header row
  lines.push('Sample ID,Sample Position,Container ID,Container Name,Container Location,Container Layout,Container Temperature,Container Type,Container Archived,Container Training,Sample Created,Sample Updated,Sample Archived,Checked Out,Checked Out By,Checked Out At')
  
  // Create a map of container IDs to container data for quick lookup
  const containerMap = new Map()
  for (const container of containers) {
    containerMap.set(container.id, container)
  }
  
  // Sort samples by container and position
  const sortedSamples = [...samples].sort((a, b) => {
    // Sort by container name first, then by position
    const containerA = containerMap.get(a.container_id)
    const containerB = containerMap.get(b.container_id)
    const nameA = containerA?.name || 'ZZZZZ' // Put checked out samples at end
    const nameB = containerB?.name || 'ZZZZZ'
    
    if (nameA !== nameB) return nameA.localeCompare(nameB)
    return (a.position || '').localeCompare(b.position || '')
  })
  
  // Output each sample with its container info
  for (const sample of sortedSamples) {
    const container = containerMap.get(sample.container_id)
    
    lines.push([
      sample.sample_id || '',
      sample.position || '',
      container?.id || '',
      container?.name || (sample.is_checked_out ? 'CHECKED OUT' : ''),
      container?.location || '',
      container?.layout || '',
      container?.temperature || '',
      container?.type || '',
      container?.archived ? 'Yes' : 'No',
      container?.training ? 'Yes' : 'No',
      sample.created_at || '',
      sample.updated_at || '',
      sample.is_archived ? 'Yes' : 'No',
      sample.is_checked_out ? 'Yes' : 'No',
      sample.checked_out_by || '',
      sample.checked_out_at || ''
    ].map(escapeCSV).join(','))
  }
  
  return lines.join('\n')
}

function escapeCSV(value: any): string {
  if (value == null) return ''
  const str = String(value)
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

module.exports = async function handler(req: any, res: any) {
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured' })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // GET /api/backups - list available backups or download specific backup
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host}`)
      const filename = url.searchParams.get('filename')
      
      // If filename is provided, return the CSV content for download
      if (filename) {
        // Fetch the backup metadata
        const { data: backup, error: backupError } = await supabaseAdmin
          .from('backups')
          .select('*')
          .eq('filename', filename)
          .single()
        
        if (backupError || !backup) {
          return res.status(404).json({ error: 'backup_not_found' })
        }
        
        // Regenerate CSV from current database state (since we don't store the actual CSV)
        const { data: containers } = await supabaseAdmin
          .from('containers')
          .select('*')
          .order('name', { ascending: true })
          .range(0, 999999)
        
        const { data: samples } = await supabaseAdmin
          .from('samples')
          .select('*')
          .order('container_id', { ascending: true })
          .range(0, 999999)
        
        const csvContent = generateCSV(containers || [], samples || [])
        
        res.setHeader('Content-Type', 'text/csv')
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
        return res.status(200).send(csvContent)
      }
      
      // Delete backups older than 14 days
      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      
      try {
        await supabaseAdmin
          .from('backups')
          .delete()
          .lt('created_at', fourteenDaysAgo.toISOString())
      } catch(e) {
        console.warn('Failed to clean up old backups:', e)
      }
      
      // Query backups table (we'll create this to store backup metadata)
      const { data, error } = await supabaseAdmin
        .from('backups')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error && error.code !== 'PGRST116') {
        console.error('Failed to fetch backups:', error)
        // If table doesn't exist yet, return empty array
        return res.status(200).json({ data: [] })
      }

      return res.status(200).json({ data: data || [] })
    }

    // POST /api/backups - generate a backup
    if (req.method === 'POST') {
      let body: any = req.body
      try { if (!body && req.json) body = await req.json() } catch(e) {}

      const isNightly = body?.nightly === true
      const userInitials = req.headers['x-user-initials'] || 'system'

      // Fetch all containers
      const { data: allContainers, error: containersError } = await supabaseAdmin
        .from('containers')
        .select('*')
        .order('name', { ascending: true })
        .range(0, 999999)

      if (containersError) {
        console.error('Failed to fetch containers:', containersError)
        return res.status(500).json({ error: 'failed_to_fetch_containers' })
      }

      // Fetch all samples with pagination (Supabase limits to 1000 per request)
      let allSamples: any[] = []
      let page = 0
      const pageSize = 1000
      let hasMore = true
      
      while (hasMore) {
        const { data: samplesPage, error: samplesError } = await supabaseAdmin
          .from('samples')
          .select('*')
          .order('created_at', { ascending: true })
          .range(page * pageSize, (page + 1) * pageSize - 1)
        
        if (samplesError) {
          console.error('Failed to fetch samples:', samplesError)
          return res.status(500).json({ error: 'failed_to_fetch_samples' })
        }
        
        if (samplesPage && samplesPage.length > 0) {
          allSamples = allSamples.concat(samplesPage)
          page++
          hasMore = samplesPage.length === pageSize
        } else {
          hasMore = false
        }
      }
      
      console.log(`Fetched ${allSamples.length} total samples across ${page} pages`)

      console.log(`Fetched ${allSamples.length} total samples across ${page} pages`)

      // Generate CSV
      const csvContent = generateCSV(allContainers || [], allSamples || [])
      const timestamp = new Date().toISOString()
      const filename = isNightly 
        ? `saga-nightly-backup-${timestamp.split('T')[0]}.csv`
        : `saga-manual-backup-${timestamp.replace(/[:.]/g, '-').split('T').join('_')}.csv`

      // Store backup metadata in database
      try {
        await supabaseAdmin
          .from('backups')
          .insert({
            filename,
            type: isNightly ? 'nightly' : 'manual',
            containers_count: allContainers?.length || 0,
            samples_count: allSamples?.length || 0,
            created_by: userInitials,
            created_at: timestamp
          })
      } catch(e) {
        console.warn('Failed to store backup metadata (table may not exist):', e)
        // Continue even if we can't store metadata
      }

      // Return CSV content
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
      return res.status(200).send(csvContent)
    }

    return res.status(405).json({ error: 'method_not_allowed' })
  } catch (err: any) {
    console.error('backups handler error', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
