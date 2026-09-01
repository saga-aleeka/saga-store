// Cron job endpoint for nightly backups
// This endpoint is called by Vercel Cron at 3am EST daily
const { createClient } = require('@supabase/supabase-js')

// Helper to generate CSV content (same as backups.ts)
function generateCSV(containers: any[], samples: any[]): string {
  const lines: string[] = []
  
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
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

module.exports = async function handler(req: any, res: any) {
  try {
    // Verify this is a cron request (Vercel sets this header)
    const authHeader = req.headers['authorization']
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('Unauthorized cron request')
      return res.status(401).json({ error: 'unauthorized' })
    }

    const SUPABASE_URL = process.env.SUPABASE_URL
    const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({ error: 'server_misconfigured' })
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    console.log('Starting nightly backup...')

    // Delete samples that have been checked out for 30+ days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    
    try {
      const { data: oldCheckouts, error: checkoutError } = await supabaseAdmin
        .from('samples')
        .select('sample_id, checked_out_at')
        .eq('is_checked_out', true)
        .lt('checked_out_at', thirtyDaysAgo.toISOString())
      
      if (checkoutError) {
        console.warn('Failed to query old checkouts:', checkoutError)
      } else if (oldCheckouts && oldCheckouts.length > 0) {
        console.log(`Deleting ${oldCheckouts.length} samples checked out for 30+ days...`)
        
        const { error: deleteError } = await supabaseAdmin
          .from('samples')
          .delete()
          .eq('is_checked_out', true)
          .lt('checked_out_at', thirtyDaysAgo.toISOString())
        
        if (deleteError) {
          console.warn('Failed to delete old checkouts:', deleteError)
        } else {
          console.log(`Deleted ${oldCheckouts.length} old checked-out samples`)
        }
      } else {
        console.log('No samples checked out for 30+ days')
      }
    } catch(e) {
      console.warn('Failed to clean up old checkouts:', e)
    }

    // Clean up backups older than 14 days
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    
    try {
      const { data: oldBackups } = await supabaseAdmin
        .from('backups')
        .select('filename, storage_path')
        .lt('created_at', fourteenDaysAgo.toISOString())
      
      if (oldBackups && oldBackups.length > 0) {
        console.log(`Deleting ${oldBackups.length} old backups...`)
        
        // Delete from storage if storage_path exists
        for (const backup of oldBackups) {
          if (backup.storage_path) {
            await supabaseAdmin.storage
              .from('backups')
              .remove([backup.storage_path])
          }
        }
        
        // Delete metadata from database
        await supabaseAdmin
          .from('backups')
          .delete()
          .lt('created_at', fourteenDaysAgo.toISOString())
        
        console.log(`Deleted ${oldBackups.length} old backups`)
      }
    } catch(e) {
      console.warn('Failed to clean up old backups:', e)
    }

    // Fetch all containers
    const { data: containers, error: containersError } = await supabaseAdmin
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
        console.error('Failed to fetch samples page:', samplesError)
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

    // Generate CSV
    const csvContent = generateCSV(containers || [], allSamples || [])
    const timestamp = new Date().toISOString()
    const filename = `saga-nightly-backup-${timestamp.split('T')[0]}.csv`

    // Store backup in Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('backups')
      .upload(filename, csvContent, {
        contentType: 'text/csv',
        upsert: true
      })

    if (uploadError) {
      console.error('Failed to upload backup to storage:', uploadError)
      // Continue even if storage fails - we still want to log it
    }

    // Store backup metadata in database
    const { error: metadataError } = await supabaseAdmin
      .from('backups')
      .insert({
        filename,
        type: 'nightly',
        containers_count: containers?.length || 0,
        samples_count: allSamples?.length || 0,
        created_by: 'system',
        created_at: timestamp,
        storage_path: uploadError ? null : filename
      })

    if (metadataError) {
      console.error('Failed to store backup metadata:', metadataError)
    }

    console.log(`Nightly backup completed: ${filename}`)
    console.log(`Containers: ${containers?.length || 0}, Samples: ${allSamples?.length || 0}`)

    return res.status(200).json({ 
      success: true, 
      filename,
      containers_count: containers?.length || 0,
      samples_count: allSamples?.length || 0
    })
  } catch (err: any) {
    console.error('Nightly backup error:', err)
    return res.status(500).json({ error: 'internal_server_error', message: String(err?.message || err) })
  }
}
