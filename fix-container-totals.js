// Script to fix containers with missing total positions
// Run with: SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key node fix-container-totals.js

const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables.')
  console.error('Usage: SUPABASE_URL=your_url SUPABASE_SERVICE_ROLE_KEY=your_key node fix-container-totals.js')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function fixContainers() {
  console.log('Fetching all containers...\n')
  
  const { data: containers, error } = await supabase
    .from('containers')
    .select('id, name, type, layout, total, used, archived')
    .order('name', { ascending: true })
  
  if (error) {
    console.error('Error fetching containers:', error)
    return
  }
  
  console.log(`Found ${containers.length} containers\n`)
  
  // Find and fix containers with missing or incorrect total
  const toFix = []
  
  for (const container of containers) {
    if (!container.layout) {
      console.log(`⚠ Skipping ${container.name} - no layout defined`)
      continue
    }
    
    const [rows, cols] = container.layout.split('x').map(n => parseInt(n))
    const calculatedTotal = rows * cols
    const correctTotal = (container.type === 'DP Pools' && container.layout === '9x9') ? 80 : calculatedTotal
    
    // Check if total is missing or incorrect
    if (container.total === null || container.total === undefined || container.total === 0 || container.total !== correctTotal) {
      toFix.push({
        id: container.id,
        name: container.name,
        type: container.type,
        layout: container.layout,
        currentTotal: container.total,
        correctTotal: correctTotal
      })
    }
  }
  
  if (toFix.length === 0) {
    console.log('✓ All containers have correct total positions!')
    return
  }
  
  console.log(`Found ${toFix.length} containers that need fixing:\n`)
  toFix.forEach(c => {
    console.log(`  - ${c.name} (${c.layout}): ${c.currentTotal} → ${c.correctTotal}`)
  })
  
  console.log('\nUpdating containers...\n')
  
  // Fix each container
  for (const container of toFix) {
    const { error } = await supabase
      .from('containers')
      .update({ total: container.correctTotal })
      .eq('id', container.id)
    
    if (error) {
      console.error(`✗ Failed to update ${container.name}:`, error)
    } else {
      console.log(`✓ Updated ${container.name}: total = ${container.correctTotal}`)
    }
  }
  
  console.log('\n✓ Done!')
}

fixContainers().catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
