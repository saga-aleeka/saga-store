#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function exec(queryPromise, label) {
  const { data, error, count } = await queryPromise
  if (error) throw new Error(`${label}: ${error.message}`)
  return { data, count }
}

function positionsForLayout(layout) {
  if (layout === '5x5') {
    const rows = ['A', 'B', 'C', 'D', 'E']
    const out = []
    for (const row of rows) {
      for (let col = 1; col <= 5; col += 1) out.push(`${row}${col}`)
    }
    return out
  }

  if (layout === '14x7') {
    const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N']
    const out = []
    for (const row of rows) {
      for (let col = 1; col <= 7; col += 1) out.push(`${row}${col}`)
    }
    return out
  }

  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']
  const out = []
  for (const row of rows) {
    for (let col = 1; col <= 9; col += 1) out.push(`${row}${col}`)
  }
  return out
}

async function main() {
  // Clean previous demo data so script is idempotent.
  await exec(supabase.from('samples').delete().ilike('sample_id', 'DEMO-%'), 'cleanup samples')
  await exec(supabase.from('cold_storage_items').delete().ilike('item_id', 'DEMO-%'), 'cleanup items')
  await exec(supabase.from('containers').delete().ilike('name', 'DEMO-%'), 'cleanup containers')
  await exec(supabase.from('cold_storage_shelves').delete().ilike('name', 'DEMO-%'), 'cleanup shelves')
  await exec(supabase.from('racks').delete().ilike('name', 'DEMO-%'), 'cleanup racks')
  await exec(supabase.from('cold_storage_units').delete().ilike('name', 'DEMO-%'), 'cleanup units')

  const unitsInput = [
    { name: 'DEMO-FREEZER-A', type: 'Freezer', temperature: '-80C', location: 'Lab West', status: 'active' },
    { name: 'DEMO-FREEZER-B', type: 'Freezer', temperature: '-20C', location: 'Lab East', status: 'active' },
    { name: 'DEMO-FRIDGE-C', type: 'Refrigerator', temperature: '4C', location: 'Prep Room', status: 'active' },
  ]

  const { data: units } = await exec(
    supabase.from('cold_storage_units').insert(unitsInput).select('id,name,type,temperature,location'),
    'insert units'
  )

  const unitByName = new Map(units.map((unit) => [unit.name, unit]))

  const racksInput = [
    { name: 'DEMO-RACK-A1', cold_storage_id: unitByName.get('DEMO-FREEZER-A').id, position: 'Left', grid_rows: 4, grid_cols: 4 },
    { name: 'DEMO-RACK-A2', cold_storage_id: unitByName.get('DEMO-FREEZER-A').id, position: 'Right', grid_rows: 4, grid_cols: 4 },
    { name: 'DEMO-RACK-B1', cold_storage_id: unitByName.get('DEMO-FREEZER-B').id, position: 'Top', grid_rows: 5, grid_cols: 3 },
    { name: 'DEMO-RACK-B2', cold_storage_id: unitByName.get('DEMO-FREEZER-B').id, position: 'Bottom', grid_rows: 5, grid_cols: 3 },
    { name: 'DEMO-RACK-C1', cold_storage_id: unitByName.get('DEMO-FRIDGE-C').id, position: 'Main', grid_rows: 3, grid_cols: 4 },
  ]

  const { data: racks } = await exec(
    supabase.from('racks').insert(racksInput).select('id,name,cold_storage_id'),
    'insert racks'
  )

  const rackByName = new Map(racks.map((rack) => [rack.name, rack]))

  const shelvesInput = []
  for (const unit of units) {
    for (let i = 1; i <= 4; i += 1) {
      shelvesInput.push({
        cold_storage_id: unit.id,
        name: `DEMO-${unit.name}-S${i}`,
        position: `S${i}`,
      })
    }
  }

  const { data: shelves } = await exec(
    supabase.from('cold_storage_shelves').insert(shelvesInput).select('id,name,cold_storage_id'),
    'insert shelves'
  )

  const shelvesByUnit = new Map()
  for (const shelf of shelves) {
    const bucket = shelvesByUnit.get(shelf.cold_storage_id) || []
    bucket.push(shelf)
    shelvesByUnit.set(shelf.cold_storage_id, bucket)
  }

  const containerPlans = [
    { name: 'DEMO-CFDNA-001', type: 'cfDNA Tubes', layout: '9x9', total: 81, temperature: '-80C', rack: 'DEMO-RACK-A1', position: 'A1' },
    { name: 'DEMO-CFDNA-002', type: 'cfDNA Tubes', layout: '9x9', total: 81, temperature: '-80C', rack: 'DEMO-RACK-A1', position: 'A2' },
    { name: 'DEMO-DP-001', type: 'DP Pools', layout: '9x9', total: 80, temperature: '-80C', rack: 'DEMO-RACK-A1', position: 'B1' },
    { name: 'DEMO-PA-001', type: 'PA Pools', layout: '5x5', total: 25, temperature: '-20C', rack: 'DEMO-RACK-A2', position: 'A1' },
    { name: 'DEMO-PA-002', type: 'PA Pools', layout: '5x5', total: 25, temperature: '-20C', rack: 'DEMO-RACK-A2', position: 'A2' },
    { name: 'DEMO-DTC-001', type: 'DTC Tubes', layout: '9x9', total: 81, temperature: '-80C', rack: 'DEMO-RACK-B1', position: 'A1' },
    { name: 'DEMO-DTC-002', type: 'DTC Tubes', layout: '9x9', total: 81, temperature: '-80C', rack: 'DEMO-RACK-B1', position: 'A2' },
    { name: 'DEMO-MNC-001', type: 'MNC Tubes', layout: '14x7', total: 98, temperature: '-80C', rack: 'DEMO-RACK-B2', position: 'A1' },
    { name: 'DEMO-PLASMA-001', type: 'Plasma Tubes', layout: '9x9', total: 81, temperature: '-20C', rack: 'DEMO-RACK-B2', position: 'A2' },
    { name: 'DEMO-BC-001', type: 'BC Tubes', layout: '9x9', total: 81, temperature: '-20C', rack: 'DEMO-RACK-C1', position: 'A1' },
    { name: 'DEMO-IDT-001', type: 'IDT Plates', layout: '14x7', total: 98, temperature: '4C', rack: 'DEMO-RACK-C1', position: 'B1' },
    { name: 'DEMO-RND-001', type: 'cfDNA Tubes', layout: '9x9', total: 81, temperature: '-80C', rack: 'DEMO-RACK-C1', position: 'C1', is_rnd: true },
  ]

  const containersInput = containerPlans.map((plan, idx) => {
    const rack = rackByName.get(plan.rack)
    const unit = units.find((u) => u.id === rack.cold_storage_id)
    return {
      name: plan.name,
      type: plan.type,
      layout: plan.layout,
      total: plan.total,
      used: 0,
      temperature: plan.temperature,
      location: `${unit.name} / ${plan.rack} / ${plan.position}`,
      archived: false,
      training: idx % 4 === 0,
      is_rnd: !!plan.is_rnd,
      rack_id: rack.id,
      rack_position: plan.position,
      cold_storage_id: unit.id,
    }
  })

  const { data: containers } = await exec(
    supabase.from('containers').insert(containersInput).select('id,name,layout,total,type,cold_storage_id'),
    'insert containers'
  )

  const samplesInput = []
  for (const [idx, container] of containers.entries()) {
    const plan = containerPlans.find((entry) => entry.name === container.name)
    const positions = positionsForLayout(plan.layout)
    let count = Math.min(plan.total, 12 + (idx % 6) * 3)

    if (plan.type === 'DP Pools') {
      count = Math.min(18, positions.length)
    }

    let added = 0
    for (const position of positions) {
      if (plan.type === 'DP Pools' && position === 'I9') continue
      if (added >= count) break
      samplesInput.push({
        sample_id: `DEMO-${container.name.replace('DEMO-', '')}-${position}`,
        container_id: container.id,
        position,
        is_archived: false,
        is_training: added % 7 === 0,
        is_checked_out: false,
        data: { status: 'stored' },
      })
      added += 1
    }
  }

  for (let i = 0; i < samplesInput.length; i += 500) {
    await exec(supabase.from('samples').insert(samplesInput.slice(i, i + 500)), `insert samples batch ${Math.floor(i / 500) + 1}`)
  }

  const itemsInput = []
  let itemCounter = 1
  for (const unit of units) {
    const unitShelves = shelvesByUnit.get(unit.id) || []
    for (const shelf of unitShelves) {
      for (let i = 0; i < 3; i += 1) {
        itemsInput.push({
          cold_storage_id: unit.id,
          shelf_id: shelf.id,
          item_id: `DEMO-ITEM-${String(itemCounter).padStart(3, '0')}`,
          lot_id: `LOT-${String(itemCounter).padStart(4, '0')}`,
          description: `Demo reagent ${itemCounter}`,
          quantity: 10 + (itemCounter % 25),
          status: 'stored',
          item_type: 'reagent',
          item_color: i % 2 === 0 ? '#22c55e' : '#3b82f6',
          sort_order: i,
        })
        itemCounter += 1
      }
    }
  }

  for (const [idx, container] of containers.slice(0, 8).entries()) {
    const unitShelves = shelvesByUnit.get(container.cold_storage_id) || []
    const shelf = unitShelves[idx % unitShelves.length]
    if (!shelf) continue

    itemsInput.push({
      cold_storage_id: container.cold_storage_id,
      shelf_id: shelf.id,
      item_id: `DEMO-CONTAINER-ITEM-${idx + 1}`,
      description: `Mapped container ${container.name}`,
      status: 'stored',
      item_type: 'container',
      container_id: container.id,
      sort_order: 100 + idx,
    })
  }

  for (let i = 0; i < itemsInput.length; i += 500) {
    await exec(supabase.from('cold_storage_items').insert(itemsInput.slice(i, i + 500)), `insert items batch ${Math.floor(i / 500) + 1}`)
  }

  const { count: containerCount } = await exec(
    supabase.from('containers').select('*', { head: true, count: 'exact' }).ilike('name', 'DEMO-%'),
    'count containers'
  )
  const { count: sampleCount } = await exec(
    supabase.from('samples').select('*', { head: true, count: 'exact' }).ilike('sample_id', 'DEMO-%'),
    'count samples'
  )
  const { count: unitCount } = await exec(
    supabase.from('cold_storage_units').select('*', { head: true, count: 'exact' }).ilike('name', 'DEMO-%'),
    'count units'
  )
  const { count: rackCount } = await exec(
    supabase.from('racks').select('*', { head: true, count: 'exact' }).ilike('name', 'DEMO-%'),
    'count racks'
  )

  console.log('seed_ok=true')
  console.log(`demo_containers=${containerCount || 0}`)
  console.log(`demo_samples=${sampleCount || 0}`)
  console.log(`demo_cold_storage_units=${unitCount || 0}`)
  console.log(`demo_racks=${rackCount || 0}`)
}

main().catch((err) => {
  console.error(err.message || String(err))
  process.exit(1)
})
