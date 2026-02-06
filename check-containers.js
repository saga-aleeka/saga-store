// Quick diagnostic script to check for containers with missing total positions
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function checkContainers() {
  console.log('Checking all containers for missing total positions...\n')
  
  // Fetch all containers
  const { data: containers, error } = await supabase
    .from('containers')
    .select('id, name, type, layout, total, used, archived')
    .order('name', { ascending: true })
  
  if (error) {
    console.error('Error fetching containers:', error)
    return
  }
  
  console.log(`Total containers found: ${containers.length}\n`)
  
  // Find containers with NULL or invalid total
  const problematic = containers.filter(c => c.total === null || c.total === undefined || c.total === 0)
  
  if (problematic.length === 0) {
    console.log('✓ All containers have valid total positions!')
  } else {
    console.log(`⚠ Found ${problematic.length} containers with missing or zero total positions:\n`)
    problematic.forEach(c => {
      console.log(`  - ID: ${c.id}`)
      console.log(`    Name: ${c.name}`)
      console.log(`    Type: ${c.type}`)
      console.log(`    Layout: ${c.layout}`)
      console.log(`    Total: ${c.total}`)
      console.log(`    Used: ${c.used}`)
      console.log(`    Archived: ${c.archived}`)
      console.log()
    })
    
    // Calculate what the total should be based on layout
    console.log('Suggested fixes:')
    problematic.forEach(c => {
      if (c.layout) {
        const [rows, cols] = c.layout.split('x').map(n => parseInt(n))
        const calculatedTotal = rows * cols
        const suggestedTotal = (c.type === 'DP Pools' && c.layout === '9x9') ? 80 : calculatedTotal
        console.log(`  - ${c.name} (${c.layout}): should be ${suggestedTotal}`)
      }
    })
  }
  
  // Also check for containers where total doesn't match layout
  const layoutMismatch = containers.filter(c => {
    if (!c.layout || c.total === null) return false
    const [rows, cols] = c.layout.split('x').map(n => parseInt(n))
    const expectedTotal = rows * cols
    const adjustedExpected = (c.type === 'DP Pools' && c.layout === '9x9') ? 80 : expectedTotal
    return c.total !== adjustedExpected
  })
  
  if (layoutMismatch.length > 0) {
    console.log(`\n⚠ Found ${layoutMismatch.length} containers where total doesn't match layout:\n`)
    layoutMismatch.forEach(c => {
      const [rows, cols] = c.layout.split('x').map(n => parseInt(n))
      const expectedTotal = rows * cols
      const adjustedExpected = (c.type === 'DP Pools' && c.layout === '9x9') ? 80 : expectedTotal
      console.log(`  - ${c.name} (${c.layout}): has total=${c.total}, expected=${adjustedExpected}`)
    })
  }
}

checkContainers().then(() => {
  console.log('\nDone!')
  process.exit(0)
}).catch(err => {
  console.error('Error:', err)
  process.exit(1)
})
