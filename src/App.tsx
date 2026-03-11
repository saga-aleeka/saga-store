import React, {useEffect, useState} from 'react'
import Header from './components/HeaderBar'
import ContainerFilters from './components/ContainerFilters'
import ContainerCard from './components/ContainerCard'
import AdminDashboard from './components/AdminDashboard'
import ContainerDetails from './components/ContainerDetails'
import ContainerCreateDrawer from './components/ContainerCreateDrawer'
import RackCreateDrawer from './components/RackCreateDrawer'
import LoginModal from './components/LoginModal'
import WorklistManager from './components/WorklistManager'
import WorklistContainerView from './components/WorklistContainerView'
import SampleHistory from './components/SampleHistory'
import ColdStorageList from './components/ColdStorageList'
import ColdStorageDetails from './components/ColdStorageDetails'
import RackDetails from './components/RackDetails'
import TagsManager from './components/TagsManager'
import { ContainerCardSkeleton, TableSkeleton } from './components/LoadingSkeleton'
import { supabase } from './lib/api'
import { getUser } from './lib/auth'
import { formatDateTime, formatDate } from './lib/dateUtils'
import { SAMPLE_TYPES } from './constants'
import { CONTAINER_LOCATION_SELECT, formatContainerLocation, getContainerLocationSearchText } from './lib/locationUtils'

// Sample type color mapping (same as ContainerFilters)
const SAMPLE_TYPE_COLORS: { [key: string]: string } = {
  'PA Pools': '#fb923c',
  'DP Pools': '#10b981',
  'cfDNA Tubes': '#9ca3af',
  'DTC Tubes': '#7c3aed',
  'MNC Tubes': '#ef4444',
  'Plasma Tubes': '#f59e0b',
  'BC Tubes': '#3b82f6',
  'IDT Plates': '#06b6d4',
  'Sample Type': '#6b7280'
}

// Compute readable text color (white or black) based on background hex
function readableTextColor(hex: string){
  try{
    const h = hex.replace('#','')
    const r = parseInt(h.substring(0,2),16)/255
    const g = parseInt(h.substring(2,4),16)/255
    const b = parseInt(h.substring(4,6),16)/255
    const Rs = r <= 0.03928 ? r/12.92 : Math.pow((r+0.055)/1.055, 2.4)
    const Gs = g <= 0.03928 ? g/12.92 : Math.pow((g+0.055)/1.055, 2.4)
    const Bs = b <= 0.03928 ? b/12.92 : Math.pow((b+0.055)/1.055, 2.4)
    const lum = 0.2126 * Rs + 0.7152 * Gs + 0.0722 * Bs
    return lum > 0.6 ? '#111827' : '#ffffff'
  }catch(e){ return '#ffffff' }
}

function buildDisplayLocation(container: any, rackMap: Map<string, any>, coldMap: Map<string, any>){
  const rack = container?.racks || (container?.rack_id ? rackMap.get(container.rack_id) : null)
  const coldStorage = rack?.cold_storage_units
    || (container?.cold_storage_id ? coldMap.get(container.cold_storage_id) : null)
    || (rack?.cold_storage_id ? coldMap.get(rack.cold_storage_id) : null)

  const parts = [coldStorage?.name, rack?.name, container?.rack_position].filter(Boolean)
  if (parts.length) return parts.join(' / ')
  return container?.location || ''
}

// Allow disabling the login modal in dev by setting VITE_DISABLE_AUTH=true in .env.local
const _rawDisable = (import.meta as any).env?.VITE_DISABLE_AUTH ?? (import.meta as any).VITE_DISABLE_AUTH
const _mode = (import.meta as any).env?.MODE ?? (import.meta as any).MODE ?? 'development'
const explicitDisable = (_rawDisable === '1' || String(_rawDisable || '').toLowerCase() === 'true')
// Default to disabling auth in local development for convenience
const DISABLE_AUTH = explicitDisable || String(_mode) === 'development'

export default function App() {
  const [route, setRoute] = useState<string>(window.location.hash || '#/containers')
  const initialUser = getUser() ?? (DISABLE_AUTH ? { initials: 'DEV', name: 'Developer' } : null)
  const [user, setUser] = useState<any | null>(initialUser)

  useEffect(() => {
    if (!DISABLE_AUTH) setUser(getUser())
  }, [])

  function signOut(){
    try{ const { clearToken, setUser: setUserStorage } = require('./lib/auth') as any; clearToken(); setUserStorage(null) }catch{}
    setUser(null)
  }

  const [containers, setContainers] = useState<any[] | null>(null)
  const [loadingContainers, setLoadingContainers] = useState(false)
  const [archivedContainers, setArchivedContainers] = useState<any[] | null>(null)
  const [loadingArchived, setLoadingArchived] = useState(false)
  const [samples, setSamples] = useState<any[] | null>(null)
  const [loadingSamples, setLoadingSamples] = useState(false)
  const [samplesCount, setSamplesCount] = useState<number | null>(null)
  const [shelfItems, setShelfItems] = useState<any[]>([])
  const [shelves, setShelves] = useState<any[]>([])
  const [coldStorageUnits, setColdStorageUnits] = useState<any[]>([])
  // filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [availableOnly, setAvailableOnly] = useState(false)
  const [trainingOnly, setTrainingOnly] = useState(false)
  // pagination for samples
  const [samplesPerPage, setSamplesPerPage] = useState(24)
  const [currentPage, setCurrentPage] = useState(1)
  const [sampleSort, setSampleSort] = useState<{ key: string; direction: 'asc' | 'desc' }>({
    key: 'created_at',
    direction: 'desc'
  })
  // pagination for containers
  const [containersPerPage, setContainersPerPage] = useState(24)
  const [containersCurrentPage, setContainersCurrentPage] = useState(1)
  // search
  const [searchQuery, setSearchQuery] = useState('')
  // sample type filters for samples page
  const [sampleTypeFilters, setSampleTypeFilters] = useState<string[]>([])
  // sample selection for checkout
  const [selectedSampleIds, setSelectedSampleIds] = useState<Set<string>>(new Set())
  const [checkoutHistory, setCheckoutHistory] = useState<Array<{sample_id: string, container_id: string, position: string}>>([])

  const loadSamples = React.useCallback(async (activeRoute?: string) => {
    const routeToUse = activeRoute ?? route
    setLoadingSamples(true)
    try{
      const isArchiveRoute = routeToUse === '#/archive'
      
      // Load ALL samples using pagination to bypass 1000 row limit
      const pageSize = 1000
      let allSamples: any[] = []
      let page = 0
      let hasMore = true
      
      console.log('Starting to load all samples...')
      
      while (hasMore) {
        const from = page * pageSize
        const to = from + pageSize - 1
        
        const query = supabase
          .from('samples')
          .select(`
            *, 
            containers:containers!samples_container_id_fkey(${CONTAINER_LOCATION_SELECT}),
            previous_containers:containers!samples_previous_container_id_fkey(${CONTAINER_LOCATION_SELECT}),
            sample_tags:sample_tags(tag_id, tags:tags(id, name, color, highlight))
          `)
          .eq('is_archived', isArchiveRoute ? true : false)
          .order('created_at', { ascending: false })

        const { data, error } = await query.range(from, to)
        
        if (error) throw error
        
        if (!data || data.length === 0) {
          hasMore = false
        } else {
          allSamples.push(...data)
          console.log(`Loaded page ${page + 1}: ${data.length} samples (total so far: ${allSamples.length})`)
          page++
          
          // If we got fewer than pageSize, we've reached the end
          if (data.length < pageSize) {
            hasMore = false
          }
        }
        
        // Safety check to prevent infinite loops
        if (page > 200) { // max 200k samples
          console.warn('Reached maximum page limit (200 pages)')
          hasMore = false
        }
      }
      
      console.log(`Loaded ${allSamples.length} total samples (archived: ${isArchiveRoute})`)
      setSamples(allSamples)
      setCurrentPage(1) // Reset to first page when reloading
    }catch(e){
      console.warn('failed to load samples', e)
      setSamples([])
    }finally{ setLoadingSamples(false) }
  }, [route])

  useEffect(() => {
    if (route === '#/samples' || route === '#/archive' || route === '#/rnd/samples') {
      loadSamples(route)
    }
  }, [route, loadSamples])

  useEffect(() => {
    const onSamplesUpdated = () => {
      if (route === '#/samples' || route === '#/archive' || route === '#/rnd/samples') {
        loadSamples(route)
      }
    }
    window.addEventListener('samples-updated', onSamplesUpdated)
    return () => window.removeEventListener('samples-updated', onSamplesUpdated)
  }, [route, loadSamples])

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
    setContainersCurrentPage(1)
  }, [searchQuery])

  // Reset containers page when filters change
  useEffect(() => {
    setContainersCurrentPage(1)
  }, [selectedTypes, availableOnly, trainingOnly])

  // Reset containers page when route changes
  useEffect(() => {
    setContainersCurrentPage(1)
  }, [route])

  // Clear sample selection and checkout history when navigating away from samples pages
  useEffect(() => {
    if (route !== '#/samples' && route !== '#/rnd/samples') {
      setSelectedSampleIds(new Set())
      setCheckoutHistory([])
    }
  }, [route])

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash || '#/containers')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Load counts for badges on mount and when route changes
  useEffect(() => {
    let mounted = true
    
    // Load active containers count
    async function loadContainersCount() {
      try {
        const { count, error } = await supabase
          .from('containers')
          .select('*', { count: 'exact', head: true })
          .eq('archived', false)
        
        if (!mounted) return
        if (error) throw error
        if (!containers) setContainers(new Array(count || 0))
      } catch(e) {
        console.warn('failed to load containers count', e)
      }
    }
    
    // Load archived containers count
    async function loadArchivedCount() {
      try {
        const { count, error } = await supabase
          .from('containers')
          .select('*', { count: 'exact', head: true })
          .eq('archived', true)
        
        if (!mounted) return
        if (error) throw error
        if (!archivedContainers) setArchivedContainers(new Array(count || 0))
      } catch(e) {
        console.warn('failed to load archived count', e)
      }
    }
    
    // Load samples count
    async function loadSamplesCount() {
      try {
        const { count, error } = await supabase
          .from('samples')
          .select('*', { count: 'exact', head: true })
          .eq('is_archived', false)
        
        if (!mounted) return
        if (error) throw error
        if (samplesCount === null) setSamplesCount(count || 0)
      } catch(e) {
        console.warn('failed to load samples count', e)
      }
    }
    
    loadContainersCount()
    loadArchivedCount()
    loadSamplesCount()
    
    return () => { mounted = false }
  }, [route, containers, archivedContainers, samplesCount])

  useEffect(() => {
    let mounted = true
    async function loadShelfItems() {
      try {
        const [{ data: itemData }, { data: shelfData }, { data: unitData }] = await Promise.all([
          supabase
            .from('cold_storage_items')
            .select('id, item_id, item_type, lot_id, description, shelf_id, cold_storage_id')
            .order('created_at', { ascending: false }),
          supabase
            .from('cold_storage_shelves')
            .select('id, name, cold_storage_id')
            .order('name', { ascending: true }),
          supabase
            .from('cold_storage_units')
            .select('id, name')
            .order('name', { ascending: true })
        ])

        if (!mounted) return
        setShelfItems(itemData || [])
        setShelves(shelfData || [])
        setColdStorageUnits(unitData || [])
      } catch (e) {
        console.warn('Failed to load shelf items for search:', e)
        if (!mounted) return
        setShelfItems([])
        setShelves([])
        setColdStorageUnits([])
      }
    }

    loadShelfItems()
    return () => {
      mounted = false
    }
  }, [])

  const samplesCountDisplay = samplesCount ?? (samples?.length ?? 0)

  const shelfById = React.useMemo(() => {
    return shelves.reduce<Record<string, any>>((acc, shelf) => {
      acc[shelf.id] = shelf
      return acc
    }, {})
  }, [shelves])

  const unitById = React.useMemo(() => {
    return coldStorageUnits.reduce<Record<string, any>>((acc, unit) => {
      acc[unit.id] = unit
      return acc
    }, {})
  }, [coldStorageUnits])

  const shelfItemMatches = React.useMemo(() => {
    if (!searchQuery.trim()) return []
    const terms = searchQuery.split(',').map(t => t.trim().toLowerCase()).filter(t => t)
    if (terms.length === 0) return []

    return shelfItems.filter((item) => {
      const shelf = shelfById[item.shelf_id]
      const unitId = item.cold_storage_id || shelf?.cold_storage_id
      const unit = unitById[unitId]
      const searchText = [
        item.item_id,
        item.item_type,
        item.lot_id,
        item.description,
        shelf?.name,
        unit?.name
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return terms.some((term) => searchText.includes(term))
    })
  }, [searchQuery, shelfItems, shelfById, unitById])

  // apply filters client-side to containers list
  const filteredContainers = React.useMemo(() => {
    if (!containers) return []
    let filtered = containers.filter((c:any) => {
      // sample type filter (if any selected)
      if (selectedTypes && selectedTypes.length){
        if (!selectedTypes.includes(c.type)) return false
      }
      if (route === '#/rnd' && !c.is_rnd) return false
      if (route === '#/containers' && c.is_rnd) return false
      // available only
      if (availableOnly){
        const used = Number(c.used || 0)
        let total = Number(c.total || 0)
        
        // DP Pools 9x9 have I9 unavailable, so effective capacity is 80 not 81
        if (c.type === 'DP Pools' && c.layout === '9x9' && total === 81) {
          total = 80
        }
        
        if ((total - used) <= 0) return false
      }
      // training only - show containers marked as training OR containing training samples
      if (trainingOnly){
        const hasTrainingSamples = (c.samples || []).some((s: any) => s.is_training && !s.is_archived)
        if (!c.training && !hasTrainingSamples) return false
      }
      return true
    })
    
    // Apply search filter (includes cross-search: searching for sample IDs will show their containers)
    if (searchQuery.trim()) {
      const terms = searchQuery.split(',').map(t => t.trim().toLowerCase()).filter(t => t)
      filtered = filtered.filter((c: any) => {
        const locationText = getContainerLocationSearchText(c)
        const containerSearchText = `${c.id || ''} ${c.name || ''} ${c.location || ''} ${locationText || ''}`.toLowerCase()
        
        // Check if container info matches
        const containerMatches = terms.some(term => containerSearchText.includes(term))
        
        // Cross-search: Check if any sample IDs in this container match
        const sampleMatches = (c.samples || []).some((s: any) => 
          terms.some(term => (s.sample_id || '').toLowerCase().includes(term))
        )
        
        return containerMatches || sampleMatches
      })
    }
    
    return filtered
  }, [containers, selectedTypes, availableOnly, trainingOnly, searchQuery, route])

  useEffect(() => {
    async function onUpdated(e: any){
      // refresh both lists when a container is updated (might be archived/unarchived)
      try {
        const [activeRes, archivedRes, racksRes, coldRes] = await Promise.all([
          supabase
            .from('containers')
            .select(`${CONTAINER_LOCATION_SELECT}, samples!samples_container_id_fkey(*)`)
            .eq('archived', false)
            .order('created_at', { ascending: false }),
          supabase
            .from('containers')
            .select(`${CONTAINER_LOCATION_SELECT}, samples!samples_container_id_fkey(*)`)
            .eq('archived', true)
            .order('created_at', { ascending: false }),
          supabase
            .from('racks')
            .select('id, name, cold_storage_id'),
          supabase
            .from('cold_storage_units')
            .select('id, name')
        ])

        const rackMap = new Map((racksRes.data || []).map((r: any) => [r.id, r]))
        const coldMap = new Map((coldRes.data || []).map((c: any) => [c.id, c]))
        
        if (activeRes.data) {
          const containersWithCounts = activeRes.data.map((c: any) => ({
            ...c,
            used: (c.samples || []).length,
            display_location: buildDisplayLocation(c, rackMap, coldMap)
          }))
          setContainers(containersWithCounts)
        }
        
        if (archivedRes.data) {
          const containersWithCounts = archivedRes.data.map((c: any) => ({
            ...c,
            used: (c.samples || []).length,
            display_location: buildDisplayLocation(c, rackMap, coldMap)
          }))
          setArchivedContainers(containersWithCounts)
        }
      } catch(e) {
        console.warn('Failed to refresh containers after update', e)
      }
    }
    window.addEventListener('container-updated', onUpdated)
    return () => window.removeEventListener('container-updated', onUpdated)
  }, [])

  useEffect(() => {
    // load archived containers when on archive route
    let mounted = true
    async function load(){
      setLoadingArchived(true)
      try{
        const [{ data, error }, { data: racksData }, { data: coldStorageData }] = await Promise.all([
          supabase
            .from('containers')
            .select(`${CONTAINER_LOCATION_SELECT}, samples!samples_container_id_fkey(*)`)
            .eq('archived', true)
            .order('created_at', { ascending: false }),
          supabase
            .from('racks')
            .select('id, name, cold_storage_id'),
          supabase
            .from('cold_storage_units')
            .select('id, name')
        ])
        
        if (!mounted) return
        if (error) {
          console.error('Failed to load archived containers:', error)
          throw error
        }
        
        console.log('Loaded archived containers:', data)
        
        // Count all samples (including archived) for each container
        const rackMap = new Map((racksData || []).map((r: any) => [r.id, r]))
        const coldMap = new Map((coldStorageData || []).map((c: any) => [c.id, c]))

        const containersWithCounts = (data ?? []).map((c: any) => ({
          ...c,
          used: (c.samples || []).length,
          display_location: buildDisplayLocation(c, rackMap, coldMap)
        }))
        
        setArchivedContainers(containersWithCounts)
      }catch(e){
        console.warn('failed to load archived', e)
        if (mounted) setArchivedContainers([])
      }finally{ if (mounted) setLoadingArchived(false) }
    }

    if (route === '#/archive') load()
    return () => { mounted = false }
  }, [route])

  useEffect(() => {
    // load active containers when on containers or R&D route
    let mounted = true
    async function load(){
      setLoadingContainers(true)
      try{
        const [{ data, error }, { data: racksData }, { data: coldStorageData }] = await Promise.all([
          supabase
            .from('containers')
            .select(`${CONTAINER_LOCATION_SELECT}, samples!samples_container_id_fkey(*)`)
            .eq('archived', false)
            .order('created_at', { ascending: false }),
          supabase
            .from('racks')
            .select('id, name, cold_storage_id'),
          supabase
            .from('cold_storage_units')
            .select('id, name')
        ])

        if (!mounted) return
        if (error) {
          console.error('Failed to load containers:', error)
          throw error
        }

        const rackMap = new Map((racksData || []).map((r: any) => [r.id, r]))
        const coldMap = new Map((coldStorageData || []).map((c: any) => [c.id, c]))

        const containersWithCounts = (data ?? []).map((c: any) => ({
          ...c,
          used: (c.samples || []).length,
          display_location: buildDisplayLocation(c, rackMap, coldMap)
        }))

        setContainers(containersWithCounts)
      }catch(e){
        console.warn('failed to load containers', e)
        if (mounted) setContainers([])
      }finally{ if (mounted) setLoadingContainers(false) }
    }

    if (route === '#/containers' || route === '#/rnd') load()
    return () => { mounted = false }
  }, [route])

  const samplesForTypeFilters = React.useMemo(() => {
    if (!samples) return []
    if (route === '#/rnd/samples') {
      return samples.filter((s: any) => {
        if (!s) return false
        const containerData = s.is_checked_out && s.previous_containers ? s.previous_containers : s.containers
        return !!containerData?.is_rnd
      })
    }
    return samples
  }, [samples, route])

  // Apply search filter and type filter to samples
  const filteredSamples = React.useMemo(() => {
    if (!samples) return []
    
    console.log(`Total samples loaded: ${samples.length}`)
    
    let filtered = samples.filter((s: any) => !!s)
    
    // Apply type filter
    if (sampleTypeFilters.length > 0) {
      filtered = filtered.filter((s: any) => {
        // For checked out samples, use previous container type; otherwise use current container type
        const containerType = s.is_checked_out && s.previous_containers?.type
          ? s.previous_containers.type
          : (s.containers?.type || 'Sample Type')
        return sampleTypeFilters.includes(containerType)
      })
      console.log(`After type filter (${sampleTypeFilters.join(', ')}): ${filtered.length} samples`)
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const terms = searchQuery.split(',').map(t => t.trim().toLowerCase()).filter(t => t)
      console.log(`Searching for terms: ${terms.join(', ')}`)
      
      filtered = filtered.filter((s: any) => {
        const checkedOutText = s.is_checked_out ? 'checked out' : ''
        // Include both current and previous container info for checked out samples
        const containerData = s.containers || s.previous_containers
        const containerName = containerData?.name || ''
        const containerLocation = getContainerLocationSearchText(containerData) || containerData?.location || ''
        const containerType = containerData?.type || ''
        const tagText = (s.sample_tags || [])
          .map((t: any) => t.tags?.name)
          .filter(Boolean)
          .join(' ')
        const searchText = `${s.sample_id || ''} ${containerName} ${containerLocation} ${containerType} ${s.position || ''} ${checkedOutText} ${tagText}`.toLowerCase()
        const matches = terms.some(term => searchText.includes(term))
        return matches
      })
      console.log(`After search filter: ${filtered.length} samples`)
    }
    
    if (route === '#/rnd/samples') {
      filtered = filtered.filter((s: any) => {
        if (!s) return false
        const containerData = s.is_checked_out && s.previous_containers ? s.previous_containers : s.containers
        return !!containerData?.is_rnd
      })
    }

    if (sampleSort.key) {
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
      const direction = sampleSort.direction === 'asc' ? 1 : -1
      const compareText = (a: string, b: string) => collator.compare(a || '', b || '') * direction
      const keyCache = new WeakMap<any, {
        sampleId: string
        type: string
        inv: string
        rack: string
        container: string
        position: string
        status: string
        tags: string
      }>()

      filtered.forEach((s: any, index: number) => {
        const containerData = s.is_checked_out && s.previous_containers ? s.previous_containers : s.containers
        const sampleId = s.sample_id || ''
        const type = containerData?.type || 'Sample Type'
        const inv = containerData?.racks?.cold_storage_units?.name || containerData?.cold_storage_units?.name || ''
        const rack = containerData?.racks?.name || ''
        const container = containerData?.name || s.container_id || ''
        const position = s.position || ''
        const status = s.is_checked_out ? 'Checked Out' : 'In Storage'
        const tags = (s.sample_tags || [])
          .map((t: any) => t.tags?.name)
          .filter(Boolean)
          .join(', ')
        keyCache.set(s, {
          sampleId,
          type,
          inv,
          rack,
          container,
          position,
          status,
          tags
        })
      })

      filtered = [...filtered].sort((a: any, b: any) => {
        const aKey = keyCache.get(a)
        const bKey = keyCache.get(b)
        if (!aKey || !bKey) return 0

        if (sampleSort.key === 'sample_id') {
          return compareText(aKey.sampleId, bKey.sampleId)
        }

        if (sampleSort.key === 'type') {
          const typeCompare = compareText(aKey.type, bKey.type)
          return typeCompare !== 0 ? typeCompare : compareText(aKey.sampleId, bKey.sampleId)
        }

        if (sampleSort.key === 'storage_path') {
          const invCompare = compareText(aKey.inv, bKey.inv)
          if (invCompare !== 0) return invCompare

          const rackCompare = compareText(aKey.rack, bKey.rack)
          if (rackCompare !== 0) return rackCompare

          const posCompare = compareText(aKey.position, bKey.position)
          if (posCompare !== 0) return posCompare

          return compareText(aKey.sampleId, bKey.sampleId)
        }

        if (sampleSort.key === 'container') {
          const nameCompare = compareText(aKey.container, bKey.container)
          return nameCompare !== 0 ? nameCompare : compareText(aKey.sampleId, bKey.sampleId)
        }

        if (sampleSort.key === 'position') {
          const posCompare = compareText(aKey.position, bKey.position)
          return posCompare !== 0 ? posCompare : compareText(aKey.sampleId, bKey.sampleId)
        }

        if (sampleSort.key === 'status') {
          const statusCompare = compareText(aKey.status, bKey.status)
          return statusCompare !== 0 ? statusCompare : compareText(aKey.sampleId, bKey.sampleId)
        }

        if (sampleSort.key === 'tags') {
          const tagsCompare = compareText(aKey.tags, bKey.tags)
          return tagsCompare !== 0 ? tagsCompare : compareText(aKey.sampleId, bKey.sampleId)
        }

        return compareText(aKey.sampleId, bKey.sampleId)
      })
    }

    console.log(`Final filtered count: ${filtered.length}`)
    return filtered
  }, [samples, searchQuery, sampleTypeFilters, sampleSort.key, sampleSort.direction])

  const downloadSamplesCsv = (rows: any[], filename: string) => {
    if (!rows.length) {
      alert('No samples to export')
      return
    }

    const escapeCsv = (value: any) => {
      const str = String(value ?? '')
      if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
      return str
    }

    const header = ['Sample ID', 'Type', 'Storage Path', 'Container', 'Position', 'Status', 'Tags']
    const lines = [header.join(',')]

    rows.forEach((s: any) => {
      const containerData = s.is_checked_out && s.previous_containers ? s.previous_containers : s.containers
      const containerName = containerData?.name || s.container_id || '-'
      const containerLocation = formatContainerLocation(containerData) || containerData?.location || '-'
      const containerType = s.is_checked_out && s.previous_containers?.type
        ? s.previous_containers.type
        : (s.containers?.type || 'Sample Type')
      const status = s.is_checked_out ? 'Checked Out' : 'In Storage'
      const tags = (s.sample_tags || [])
        .map((t: any) => t.tags?.name)
        .filter(Boolean)
        .join('; ')

      lines.push([
        escapeCsv(s.sample_id || ''),
        escapeCsv(containerType),
        escapeCsv(containerLocation),
        escapeCsv(containerName),
        escapeCsv(s.position || ''),
        escapeCsv(status),
        escapeCsv(tags)
      ].join(','))
    })

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  // worklist container view route: #/worklist/container/:id
  if (route.startsWith('#/worklist/container/') && route.split('/').length >= 4) {
    const parts = route.split('/')
    const idWithQuery = decodeURIComponent(parts[3])
    const id = idWithQuery.split('?')[0]
    
    // Parse positions from query string
    const positionsMatch = route.match(/[?&]positions=([^&]+)/)
    const positions = positionsMatch 
      ? decodeURIComponent(positionsMatch[1]).split(',')
      : []

    return (
      <div className="app">
        <Header route="#/worklist" user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samplesCountDisplay} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{marginTop:18}}>
          <WorklistContainerView 
            containerId={id} 
            highlightPositions={positions}
            onBack={() => { window.location.hash = '#/worklist' }}
          />
        </div>
      </div>
    )
  }

  // sample history route: #/samples/:sampleId/history
  if (route.startsWith('#/samples/') && route.includes('/history')) {
    const parts = route.split('/')
    const sampleId = decodeURIComponent(parts[2])
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samplesCountDisplay} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{marginTop:18}}>
          <SampleHistory sampleId={sampleId} onBack={() => { window.location.hash = '#/samples' }} />
        </div>
      </div>
    )
  }

  // cold storage detail route: #/cold-storage/:id
  if (route.startsWith('#/cold-storage/') && route.split('/').length >= 3) {
    const parts = route.split('/')
    const idWithQuery = decodeURIComponent(parts[2])
    const id = idWithQuery.split('?')[0]
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samplesCountDisplay} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{marginTop:18}}>
          <ColdStorageDetails id={id} />
        </div>
      </div>
    )
  }

  // rack detail route: #/racks/:id
  if (route.startsWith('#/racks/') && route.split('/').length >= 3) {
    const parts = route.split('/')
    const idWithQuery = decodeURIComponent(parts[2])
    const id = idWithQuery.split('?')[0]
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samplesCountDisplay} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{marginTop:18}}>
          <RackDetails id={id} />
        </div>
      </div>
    )
  }

  // container detail route: #/containers/:id
  if (route.startsWith('#/containers/') && route.split('/').length >= 3) {
    const parts = route.split('/')
    const idWithQuery = decodeURIComponent(parts[2])
    const id = idWithQuery.split('?')[0]
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samplesCountDisplay} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{marginTop:18}}>
          <ContainerDetails id={id} />
        </div>
      </div>
    )
  }

  if (route === '#/cold-storage') {
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samplesCountDisplay} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{marginTop:18}}>
          <ColdStorageList />
        </div>
      </div>
    )
  }

  if (route === '#/tags') {
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samplesCountDisplay} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{marginTop:18}}>
          <TagsManager />
        </div>
      </div>
    )
  }

  if (route === '#/new'){
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samplesCountDisplay} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{marginTop:18}}>
          <ContainerCreateDrawer onClose={() => { window.location.hash = '#/containers' }} />
        </div>
      </div>
    )
  }

  if (route === '#/new-storage') {
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samplesCountDisplay} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{ marginTop: 18 }}>
          <ContainerCreateDrawer
            onClose={() => { window.location.hash = '#/cold-storage' }}
            initialMode="storage"
          />
        </div>
      </div>
    )
  }

  if (route === '#/new-rack') {
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samples?.length ?? 0} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{ marginTop: 18 }}>
          <RackCreateDrawer onClose={() => { window.location.hash = '#/cold-storage' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="app">
  <Header route={route} user={user} onSignOut={signOut} isAdmin={route === '#/admin'} onExitAdmin={() => { window.location.hash = '#/containers' }} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samplesCountDisplay} searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      {!user && (
        <LoginModal onSuccess={(u:any) => setUser(u)} />
      )}

      <div style={{marginTop:18}}>
        {(route === '#/containers' || route === '#/rnd') && (
          <>
            {route === '#/rnd' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <button
                  className="btn"
                  style={{ background: '#3b82f6', color: 'white', fontSize: 13 }}
                  onClick={() => { window.location.hash = '#/rnd' }}
                >
                  R&amp;D Containers
                </button>
                <button
                  className="btn ghost"
                  style={{ fontSize: 13 }}
                  onClick={() => { window.location.hash = '#/rnd/samples' }}
                >
                  R&amp;D Samples
                </button>
              </div>
            )}
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
              <div className="muted">
                Showing {filteredContainers ? `${Math.min((containersCurrentPage - 1) * containersPerPage + 1, filteredContainers.length)}-${Math.min(containersCurrentPage * containersPerPage, filteredContainers.length)} of ${filteredContainers.length}` : '...'} active containers
              </div>
              <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <button className="btn" onClick={() => { window.location.hash = '#/new' }}>
                  New Container
                </button>
                <span className="muted" style={{fontSize: 13}}>Per page:</span>
                <select
                  value={containersPerPage}
                  onChange={(e) => {
                    const nextSize = parseInt(e.target.value, 10)
                    setContainersPerPage(nextSize)
                    setContainersCurrentPage(1)
                  }}
                  style={{
                    padding: '4px 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 13,
                    background: 'white'
                  }}
                >
                  {[24, 48, 96].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Filters */}
            <div style={{marginTop:8}}>
              <ContainerFilters selected={selectedTypes} onChange={(s:any)=> setSelectedTypes(s)} availableOnly={availableOnly} onAvailableChange={setAvailableOnly} trainingOnly={trainingOnly} onTrainingChange={setTrainingOnly} />
            </div>
            {!loadingContainers && filteredContainers && filteredContainers.length > containersPerPage && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                marginTop: 12
              }}>
                <button
                  onClick={() => setContainersCurrentPage(p => Math.max(1, p - 1))}
                  disabled={containersCurrentPage === 1}
                  style={{
                    padding: '6px 12px',
                    background: containersCurrentPage === 1 ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: containersCurrentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: containersCurrentPage === 1 ? '#9ca3af' : '#374151'
                  }}
                >
                  Previous
                </button>
                <span className="muted" style={{fontSize: 13}}>
                  Page {containersCurrentPage} of {Math.ceil(filteredContainers.length / containersPerPage)}
                </span>
                <button
                  onClick={() => setContainersCurrentPage(p => Math.min(Math.ceil(filteredContainers.length / containersPerPage), p + 1))}
                  disabled={containersCurrentPage >= Math.ceil(filteredContainers.length / containersPerPage)}
                  style={{
                    padding: '6px 12px',
                    background: containersCurrentPage >= Math.ceil(filteredContainers.length / containersPerPage) ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: containersCurrentPage >= Math.ceil(filteredContainers.length / containersPerPage) ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: containersCurrentPage >= Math.ceil(filteredContainers.length / containersPerPage) ? '#9ca3af' : '#374151'
                  }}
                >
                  Next
                </button>
              </div>
            )}
            <div className="container-list">
              {loadingContainers && [...Array(6)].map((_, i) => (
                <ContainerCardSkeleton key={`container-skeleton-${i}`} />
              ))}
              {!loadingContainers && filteredContainers && filteredContainers.length === 0 && <div className="muted">No active containers</div>}
              {!loadingContainers && filteredContainers && filteredContainers.slice((containersCurrentPage - 1) * containersPerPage, containersCurrentPage * containersPerPage).map(c => (
                <ContainerCard
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  type={c.type}
                  temperature={c.temperature}
                  layout={c.layout}
                  occupancy={{used:c.used,total:c.total}}
                  updatedAt={c.updated_at}
                  location={c.display_location || c.location}
                  training={c.training}
                  is_rnd={c.is_rnd}
                  cold_storage_id={c.cold_storage_id}
                  rack_id={c.rack_id}
                  rack_position={c.rack_position}
                  returnTo={route === '#/rnd' ? 'rnd' : undefined}
                />
              ))}
            </div>
            {searchQuery.trim() && shelfItemMatches.length > 0 && (
              <div style={{ marginTop: 16, border: '1px solid #e5e7eb', borderRadius: 8, background: 'white' }}>
                <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Shelf items matching search</div>
                <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                  {shelfItemMatches.map((item) => {
                    const shelf = shelfById[item.shelf_id]
                    const unitId = item.cold_storage_id || shelf?.cold_storage_id
                    const unit = unitById[unitId]
                    return (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.item_id}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {(item.item_type || 'item').toUpperCase()} • {unit?.name || 'Unknown unit'} {shelf?.name ? `• ${shelf.name}` : ''}
                          </div>
                        </div>
                        {unitId && (
                          <button className="btn ghost" onClick={() => { window.location.hash = `#/cold-storage/${unitId}` }}>
                            View shelf
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {!loadingContainers && filteredContainers && filteredContainers.length > containersPerPage && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                marginTop: 16
              }}>
                <button
                  onClick={() => setContainersCurrentPage(p => Math.max(1, p - 1))}
                  disabled={containersCurrentPage === 1}
                  style={{
                    padding: '6px 12px',
                    background: containersCurrentPage === 1 ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: containersCurrentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: containersCurrentPage === 1 ? '#9ca3af' : '#374151'
                  }}
                >
                  Previous
                </button>
                <span className="muted" style={{fontSize: 13}}>
                  Page {containersCurrentPage} of {Math.ceil(filteredContainers.length / containersPerPage)}
                </span>
                <button
                  onClick={() => setContainersCurrentPage(p => Math.min(Math.ceil(filteredContainers.length / containersPerPage), p + 1))}
                  disabled={containersCurrentPage >= Math.ceil(filteredContainers.length / containersPerPage)}
                  style={{
                    padding: '6px 12px',
                    background: containersCurrentPage >= Math.ceil(filteredContainers.length / containersPerPage) ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: containersCurrentPage >= Math.ceil(filteredContainers.length / containersPerPage) ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: containersCurrentPage >= Math.ceil(filteredContainers.length / containersPerPage) ? '#9ca3af' : '#374151'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}

        {route === '#/archive' && (
          <>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
              <div className="muted">
                Showing {archivedContainers ? `${Math.min((containersCurrentPage - 1) * containersPerPage + 1, archivedContainers.length)}-${Math.min(containersCurrentPage * containersPerPage, archivedContainers.length)} of ${archivedContainers.length}` : '...'} archived containers
              </div>
              <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <span className="muted" style={{fontSize: 13}}>Per page:</span>
                <select
                  value={containersPerPage}
                  onChange={(e) => {
                    const nextSize = parseInt(e.target.value, 10)
                    setContainersPerPage(nextSize)
                    setContainersCurrentPage(1)
                  }}
                  style={{
                    padding: '4px 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 13,
                    background: 'white'
                  }}
                >
                  {[24, 48, 96].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>
            {!loadingArchived && archivedContainers && archivedContainers.length > containersPerPage && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                marginTop: 12
              }}>
                <button
                  onClick={() => setContainersCurrentPage(p => Math.max(1, p - 1))}
                  disabled={containersCurrentPage === 1}
                  style={{
                    padding: '6px 12px',
                    background: containersCurrentPage === 1 ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: containersCurrentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: containersCurrentPage === 1 ? '#9ca3af' : '#374151'
                  }}
                >
                  Previous
                </button>
                <span className="muted" style={{fontSize: 13}}>
                  Page {containersCurrentPage} of {Math.ceil(archivedContainers.length / containersPerPage)}
                </span>
                <button
                  onClick={() => setContainersCurrentPage(p => Math.min(Math.ceil(archivedContainers.length / containersPerPage), p + 1))}
                  disabled={containersCurrentPage >= Math.ceil(archivedContainers.length / containersPerPage)}
                  style={{
                    padding: '6px 12px',
                    background: containersCurrentPage >= Math.ceil(archivedContainers.length / containersPerPage) ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: containersCurrentPage >= Math.ceil(archivedContainers.length / containersPerPage) ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: containersCurrentPage >= Math.ceil(archivedContainers.length / containersPerPage) ? '#9ca3af' : '#374151'
                  }}
                >
                  Next
                </button>
              </div>
            )}
            <div className="container-list">
              {loadingArchived && [...Array(6)].map((_, i) => (
                <ContainerCardSkeleton key={`archived-skeleton-${i}`} />
              ))}
              {!loadingArchived && archivedContainers && archivedContainers.length === 0 && <div className="muted">No archived containers</div>}
              {!loadingArchived && archivedContainers && archivedContainers.slice((containersCurrentPage - 1) * containersPerPage, containersCurrentPage * containersPerPage).map((c:any) => (
                <ContainerCard
                  key={c.id}
                  id={c.id}
                  name={c.name}
                  type={c.type}
                  temperature={c.temperature}
                  layout={c.layout}
                  occupancy={{used:c.used,total:c.total}}
                  updatedAt={c.updated_at}
                  location={c.display_location || c.location}
                  training={c.training}
                  archived={c.archived}
                  is_rnd={c.is_rnd}
                  cold_storage_id={c.cold_storage_id}
                  rack_id={c.rack_id}
                  rack_position={c.rack_position}
                />
              ))}
            </div>
            {!loadingArchived && archivedContainers && archivedContainers.length > containersPerPage && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                marginTop: 16
              }}>
                <button
                  onClick={() => setContainersCurrentPage(p => Math.max(1, p - 1))}
                  disabled={containersCurrentPage === 1}
                  style={{
                    padding: '6px 12px',
                    background: containersCurrentPage === 1 ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: containersCurrentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: containersCurrentPage === 1 ? '#9ca3af' : '#374151'
                  }}
                >
                  Previous
                </button>
                <span className="muted" style={{fontSize: 13}}>
                  Page {containersCurrentPage} of {Math.ceil(archivedContainers.length / containersPerPage)}
                </span>
                <button
                  onClick={() => setContainersCurrentPage(p => Math.min(Math.ceil(archivedContainers.length / containersPerPage), p + 1))}
                  disabled={containersCurrentPage >= Math.ceil(archivedContainers.length / containersPerPage)}
                  style={{
                    padding: '6px 12px',
                    background: containersCurrentPage >= Math.ceil(archivedContainers.length / containersPerPage) ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: containersCurrentPage >= Math.ceil(archivedContainers.length / containersPerPage) ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: containersCurrentPage >= Math.ceil(archivedContainers.length / containersPerPage) ? '#9ca3af' : '#374151'
                  }}
                >
                  Next
                </button>
              </div>
            )}
            
            <div style={{marginTop:32,paddingTop:24,borderTop:'1px solid #e5e7eb'}}>
              <h3 style={{fontSize:18,fontWeight:600,marginBottom:12}}>Archived Samples</h3>
              <div className="muted" style={{marginBottom:12}}>Samples marked as archived</div>
              {loadingSamples && <div className="muted">Loading archived samples...</div>}
              {!loadingSamples && samples && samples.length === 0 && (
                <div className="muted">No archived samples</div>
              )}
              {!loadingSamples && samples && samples.length > 0 && (
                <div>
                  {samples.map((s:any) => {
                    const handleSampleClick = async () => {
                      window.location.hash = `#/containers/${s.container_id}?highlight=${encodeURIComponent(s.position)}`
                    }
                    
                    const containerName = s.containers?.name || s.container_id
                    const containerLocation = formatContainerLocation(s.containers) || s.containers?.location || 'Location unknown'
                    
                    return (
                      <div key={s.id} className="sample-row" style={{marginTop:8,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div style={{display:'flex',gap:12,alignItems:'center',flex:1}}>
                          <div style={{width:36,height:36,flex:'none',borderRadius:6,background:'#eee',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:700,fontSize:12}}>{s.owner ? s.owner[0].toUpperCase() : (s.sample_id || s.id).slice(-2)}</div>
                          <div style={{flex:1}}>
                            <div style={{fontWeight:700,fontSize:14}}>{s.sample_id}</div>
                            <div style={{marginTop:4}}>
                              <button
                                onClick={handleSampleClick}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 10px',
                                  background: '#fef3c7',
                                  border: '1px solid #fde68a',
                                  borderRadius: 6,
                                  fontSize: 13,
                                  cursor: 'pointer',
                                  color: '#92400e'
                                }}
                              >
                                {containerName} • {s.position}
                              </button>
                            </div>
                            {s.data?.collected_at && (
                              <div className="muted" style={{marginTop:4}}>Collected: {formatDate(s.data.collected_at)}</div>
                            )}
                            <div className="muted" style={{marginTop:4}}>Storage Path: {containerLocation}</div>
                          </div>
                        </div>
                        <div className="muted" style={{fontSize:13}}>Archived {formatDateTime(s.updated_at)}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {(route === '#/samples' || route === '#/rnd/samples') && (
          <div>
            {route === '#/rnd/samples' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <button
                  className="btn ghost"
                  style={{ fontSize: 13 }}
                  onClick={() => { window.location.hash = '#/rnd' }}
                >
                  R&amp;D Containers
                </button>
                <button
                  className="btn"
                  style={{ background: '#3b82f6', color: 'white', fontSize: 13 }}
                  onClick={() => { window.location.hash = '#/rnd/samples' }}
                >
                  R&amp;D Samples
                </button>
              </div>
            )}
            {searchQuery.trim() && shelfItemMatches.length > 0 && (
              <div style={{ marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 8, background: 'white' }}>
                <div style={{ padding: 12, borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>Shelf items matching search</div>
                <div style={{ padding: 12, display: 'grid', gap: 8 }}>
                  {shelfItemMatches.map((item) => {
                    const shelf = shelfById[item.shelf_id]
                    const unitId = item.cold_storage_id || shelf?.cold_storage_id
                    const unit = unitById[unitId]
                    return (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.item_id}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {(item.item_type || 'item').toUpperCase()} • {unit?.name || 'Unknown unit'} {shelf?.name ? `• ${shelf.name}` : ''}
                          </div>
                        </div>
                        {unitId && (
                          <button className="btn ghost" onClick={() => { window.location.hash = `#/cold-storage/${unitId}` }}>
                            View shelf
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {/* Action buttons */}
            {filteredSamples && filteredSamples.length > 0 && (
              <div style={{marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap'}}>
                <button 
                  className="btn ghost"
                  onClick={() => {
                    const pageIds = filteredSamples
                      .slice((currentPage - 1) * samplesPerPage, currentPage * samplesPerPage)
                      .filter((s: any) => s.id && !s.is_checked_out && s.container_id)
                      .map((s: any) => s.id)
                    setSelectedSampleIds(new Set([...selectedSampleIds, ...pageIds]))
                  }}
                  disabled={loadingSamples}
                  style={{fontSize: 13}}
                >
                  Select All on Page
                </button>
                <button 
                  className="btn ghost"
                  onClick={() => setSelectedSampleIds(new Set())}
                  disabled={loadingSamples || selectedSampleIds.size === 0}
                  style={{fontSize: 13}}
                >
                  Deselect All
                </button>
                <div style={{flex: 1}} />
                <button 
                  className="btn"
                  onClick={async () => {
                    const selectedSamples = filteredSamples.filter((s: any) => selectedSampleIds.has(s.id))
                    if (selectedSamples.length === 0) {
                      alert('No samples selected')
                      return
                    }
                    
                    const user = getUser()
                    if (!user) {
                      alert('You must be signed in to checkout samples')
                      return
                    }
                    
                    setLoadingSamples(true)
                    try {
                      const history: Array<{sample_id: string, container_id: string, position: string}> = []
                      
                      for (const sample of selectedSamples) {
                        if (sample.is_checked_out || !sample.container_id) continue
                        
                        // Save to history before checkout
                        history.push({
                          sample_id: sample.sample_id,
                          container_id: sample.container_id,
                          position: sample.position
                        })
                        
                        const { error } = await supabase
                          .from('samples')
                          .update({
                            is_checked_out: true,
                            checked_out_at: new Date().toISOString(),
                            checked_out_by: user.initials,
                            previous_container_id: sample.container_id,
                            previous_position: sample.position,
                            container_id: null,
                            position: null
                          })
                          .eq('id', sample.id)
                        
                        if (error) {
                          console.error('Checkout error:', error)
                          alert(`Failed to checkout ${sample.sample_id}: ${error.message}`)
                          return
                        }
                      }
                      
                      setCheckoutHistory([...checkoutHistory, ...history])
                      setSelectedSampleIds(new Set())
                      
                      // Reload samples
                      const isArchiveRoute = route === '#/archive'
                      const { data } = await supabase
                        .from('samples')
                        .select(`*, containers:containers!samples_container_id_fkey(${CONTAINER_LOCATION_SELECT}), previous_containers:containers!samples_previous_container_id_fkey(${CONTAINER_LOCATION_SELECT}), sample_tags:sample_tags(tag_id, tags:tags(id, name, color, highlight))`)
                        .eq('is_archived', isArchiveRoute)
                        .order('updated_at', { ascending: false })
                      
                      if (data) setSamples(data)
                      
                      alert(`Checked out ${history.length} sample(s)`)
                    } catch (err: any) {
                      console.error('Checkout error:', err)
                      alert(`Failed to checkout samples: ${err.message}`)
                    } finally {
                      setLoadingSamples(false)
                    }
                  }}
                  disabled={loadingSamples || selectedSampleIds.size === 0}
                  style={{background: '#10b981', color: 'white', fontSize: 13}}
                >
                  Checkout Selected ({selectedSampleIds.size})
                </button>
                <button 
                  className="btn"
                  onClick={async () => {
                    if (checkoutHistory.length === 0) {
                      alert('No checkout history to undo')
                      return
                    }
                    
                    setLoadingSamples(true)
                    try {
                      for (const item of checkoutHistory) {
                        // Find sample by sample_id
                        const sample = samples?.find((s: any) => s.sample_id === item.sample_id)
                        if (!sample) continue
                        
                        const { error } = await supabase
                          .from('samples')
                          .update({
                            container_id: item.container_id,
                            position: item.position,
                            is_checked_out: false,
                            checked_out_at: null,
                            checked_out_by: null,
                            previous_container_id: null,
                            previous_position: null
                          })
                          .eq('id', sample.id)
                        
                        if (error) {
                          console.error('Undo checkout error:', error)
                          alert(`Failed to undo checkout for ${item.sample_id}: ${error.message}`)
                          return
                        }
                      }
                      
                      setCheckoutHistory([])
                      
                      // Reload samples
                      const isArchiveRoute = route === '#/archive'
                      const { data } = await supabase
                        .from('samples')
                        .select(`*, containers:containers!samples_container_id_fkey(${CONTAINER_LOCATION_SELECT}), previous_containers:containers!samples_previous_container_id_fkey(${CONTAINER_LOCATION_SELECT}), sample_tags:sample_tags(tag_id, tags:tags(id, name, color, highlight))`)
                        .eq('is_archived', isArchiveRoute)
                        .order('updated_at', { ascending: false })
                      
                      if (data) setSamples(data)
                      
                      alert('Checkout undone successfully')
                    } catch (err: any) {
                      console.error('Undo checkout error:', err)
                      alert(`Failed to undo checkout: ${err.message}`)
                    } finally {
                      setLoadingSamples(false)
                    }
                  }}
                  disabled={loadingSamples || checkoutHistory.length === 0}
                  style={{background: '#f59e0b', color: 'white', fontSize: 13}}
                >
                  Undo Checkout ({checkoutHistory.length})
                </button>
                <button
                  className="btn ghost"
                  onClick={() => {
                    const selected = filteredSamples.filter((s: any) => selectedSampleIds.has(s.id))
                    if (selected.length > 0) {
                      downloadSamplesCsv(selected, 'samples-selected.csv')
                      return
                    }
                    downloadSamplesCsv(filteredSamples, 'samples-filtered.csv')
                  }}
                  disabled={loadingSamples || filteredSamples.length === 0}
                  style={{fontSize: 13}}
                >
                  Download CSV
                </button>
              </div>
            )}
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
              <div className="muted">
                Showing {filteredSamples ? `${Math.min((currentPage - 1) * samplesPerPage + 1, filteredSamples.length)}-${Math.min(currentPage * samplesPerPage, filteredSamples.length)} of ${filteredSamples.length}` : '...'} samples
              </div>
              <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <span className="muted" style={{fontSize: 13}}>Per page:</span>
                <select
                  value={samplesPerPage}
                  onChange={(e) => {
                    const nextSize = parseInt(e.target.value, 10)
                    setSamplesPerPage(nextSize)
                    setCurrentPage(1)
                  }}
                  style={{
                    padding: '4px 10px',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    fontSize: 13,
                    background: 'white'
                  }}
                >
                  {[24, 48, 96].map((size) => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* Sample Type Filters */}
            {(() => {
              // Use the same order as ContainerFilters
              const typeOrder = ['PA Pools', 'DP Pools', 'cfDNA Tubes', 'DTC Tubes', 'MNC Tubes', 'Plasma Tubes', 'BC Tubes', 'IDT Plates', 'Other']
                          {!loadingSamples && filteredSamples && filteredSamples.length > samplesPerPage && (
                            <div style={{
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: 8,
                              marginTop: 12
                            }}>
                              <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                style={{
                                  padding: '6px 12px',
                                  background: currentPage === 1 ? '#f3f4f6' : 'white',
                                  border: '1px solid #d1d5db',
                                  borderRadius: 6,
                                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                  fontSize: 13,
                                  color: currentPage === 1 ? '#9ca3af' : '#374151'
                                }}
                              >
                                Previous
                              </button>
                              <span className="muted" style={{fontSize: 13}}>
                                Page {currentPage} of {Math.ceil(filteredSamples.length / samplesPerPage)}
                              </span>
                              <button
                                onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredSamples.length / samplesPerPage), p + 1))}
                                disabled={currentPage >= Math.ceil(filteredSamples.length / samplesPerPage)}
                                style={{
                                  padding: '6px 12px',
                                  background: currentPage >= Math.ceil(filteredSamples.length / samplesPerPage) ? '#f3f4f6' : 'white',
                                  border: '1px solid #d1d5db',
                                  borderRadius: 6,
                                  cursor: currentPage >= Math.ceil(filteredSamples.length / samplesPerPage) ? 'not-allowed' : 'pointer',
                                  fontSize: 13,
                                  color: currentPage >= Math.ceil(filteredSamples.length / samplesPerPage) ? '#9ca3af' : '#374151'
                                }}
                              >
                                Next
                              </button>
                            </div>
                          )}
              const allTypesInSamples = samplesForTypeFilters.length ? Array.from(new Set(samplesForTypeFilters.map((s: any) => {
                // For checked out samples, use previous container type; otherwise use current container type
                return s.is_checked_out && s.previous_containers?.type
                  ? s.previous_containers.type
                  : (s.containers?.type || 'Sample Type')
              }))).filter(type => type !== 'Sample Type') : []
              
              // Filter to only types present in the samples, but maintain the defined order
              const availableSampleTypes = typeOrder.filter(type => allTypesInSamples.includes(type))
              
              if (availableSampleTypes.length > 0) {
                return (
                  <div style={{marginTop: 12, marginBottom: 16, padding: 12, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb'}}>
                    <div style={{fontSize: 14, fontWeight: 600, marginBottom: 8}}>Filter by Sample Type:</div>
                    <div style={{display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center'}}>
                      {availableSampleTypes.map(type => {
                        const active = sampleTypeFilters.includes(type)
                        const color = SAMPLE_TYPE_COLORS[type] || '#6b7280'
                        const inactiveBg = `${color}22`
                        const activeBg = color
                        const style = active 
                          ? { background: activeBg, color: readableTextColor(activeBg), boxShadow: `0 0 0 3px ${color}33`, border: 'none' } 
                          : { background: inactiveBg, color: color, border: 'none' }
                        
                        return (
                          <button
                            key={type}
                            onClick={() => {
                              if (active) {
                                setSampleTypeFilters(sampleTypeFilters.filter(t => t !== type))
                              } else {
                                setSampleTypeFilters([...sampleTypeFilters, type])
                              }
                              setCurrentPage(1)
                            }}
                            style={{
                              ...style,
                              padding: '6px 12px',
                              borderRadius: 9999,
                              fontSize: 14,
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              outline: 'none'
                            }}
                          >
                            {type}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              }
              return null
            })()}
            
            {loadingSamples && (
              <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, background: 'white' }}>
                <TableSkeleton rows={6} columns={8} />
              </div>
            )}
            {!loadingSamples && filteredSamples && filteredSamples.length === 0 && <div className="muted">No samples found</div>}
            {!loadingSamples && filteredSamples && filteredSamples.length > 0 && (
              <div style={{border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden'}}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <thead style={{background: '#f3f4f6'}}>
                    <tr>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: 40}}>
                        <input
                          type="checkbox"
                          checked={filteredSamples.slice((currentPage - 1) * samplesPerPage, currentPage * samplesPerPage).filter((s: any) => !s.is_checked_out && s.container_id).length > 0 && 
                                   filteredSamples.slice((currentPage - 1) * samplesPerPage, currentPage * samplesPerPage).filter((s: any) => !s.is_checked_out && s.container_id).every((s: any) => selectedSampleIds.has(s.id))}
                          onChange={(e) => {
                            const pageIds = filteredSamples
                              .slice((currentPage - 1) * samplesPerPage, currentPage * samplesPerPage)
                              .filter((s: any) => !s.is_checked_out && s.container_id)
                              .map((s: any) => s.id)
                            if (e.target.checked) {
                              setSelectedSampleIds(new Set([...selectedSampleIds, ...pageIds]))
                            } else {
                              const newSelected = new Set(selectedSampleIds)
                              pageIds.forEach(id => newSelected.delete(id))
                              setSelectedSampleIds(newSelected)
                            }
                          }}
                        />
                      </th>
                      {([
                        { label: 'Sample ID', key: 'sample_id' },
                        { label: 'Type', key: 'type' },
                        { label: 'Storage Path', key: 'storage_path' },
                        { label: 'Container', key: 'container' },
                        { label: 'Position', key: 'position' },
                        { label: 'Status', key: 'status' },
                        { label: 'Tags', key: 'tags' }
                      ] as Array<{ label: string; key: string }>).map((col) => {
                        const isActive = sampleSort.key === col.key
                        const direction = isActive ? sampleSort.direction : 'asc'
                        return (
                          <th key={col.key} style={{padding: 12, textAlign: 'left', fontWeight: 600}}>
                            <button
                              onClick={() => {
                                setSampleSort((prev) => {
                                  if (prev.key === col.key) {
                                    return { key: col.key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                                  }
                                  return { key: col.key, direction: 'asc' }
                                })
                                setCurrentPage(1)
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                fontWeight: 600,
                                cursor: 'pointer',
                                color: isActive ? '#111827' : '#1f2937'
                              }}
                              aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                            >
                              {col.label}
                              <span style={{ fontSize: 12, opacity: isActive ? 1 : 0.35 }}>
                                {direction === 'asc' ? '▲' : '▼'}
                              </span>
                            </button>
                          </th>
                        )
                      })}
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSamples.slice((currentPage - 1) * samplesPerPage, currentPage * samplesPerPage).map((s: any, index: number) => {
                      const handleSampleClick = () => {
                        const returnTo = route === '#/rnd/samples' ? 'rnd-samples' : 'samples'
                        window.location.hash = `#/containers/${s.container_id}?highlight=${encodeURIComponent(s.position)}&returnTo=${returnTo}`
                      }
                      
                      const containerData = s.is_checked_out && s.previous_containers ? s.previous_containers : s.containers
                      const containerName = containerData?.name || s.container_id || '-'
                      const containerLocation = formatContainerLocation(containerData) || containerData?.location || '-'
                      // For checked out samples, use previous container type; otherwise use current container type
                      const containerType = s.is_checked_out && s.previous_containers?.type
                        ? s.previous_containers.type
                        : (s.containers?.type || 'Sample Type')
                      const typeColor = SAMPLE_TYPE_COLORS[containerType] || '#6b7280'
                      const tagItems = (s.sample_tags || [])
                        .map((t: any) => t.tags)
                        .filter(Boolean)
                      
                      return (
                        <tr 
                          key={s.id}
                          style={{
                            borderTop: index > 0 ? '1px solid #e5e7eb' : 'none',
                            background: selectedSampleIds.has(s.id) ? '#eff6ff' : 'white'
                          }}
                        >
                          <td style={{padding: 12}}>
                            <input
                              type="checkbox"
                              checked={selectedSampleIds.has(s.id)}
                              disabled={s.is_checked_out || !s.container_id}
                              onChange={(e) => {
                                const newSelected = new Set(selectedSampleIds)
                                if (e.target.checked) {
                                  newSelected.add(s.id)
                                } else {
                                  newSelected.delete(s.id)
                                }
                                setSelectedSampleIds(newSelected)
                              }}
                            />
                          </td>
                          <td style={{padding: 12}}>
                            <button
                              onClick={() => window.location.hash = `#/samples/${encodeURIComponent(s.sample_id)}/history`}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#3b82f6',
                                fontWeight: 600,
                                fontSize: 14,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                padding: 0
                              }}
                            >
                              {s.sample_id}
                            </button>
                          </td>
                          <td style={{padding: 12}}>
                            <span style={{
                              padding: '4px 10px',
                              background: `${typeColor}22`,
                              color: typeColor,
                              borderRadius: 9999,
                              fontSize: 13,
                              fontWeight: 500
                            }}>
                              {containerType}
                            </span>
                          </td>
                          <td style={{padding: 12}}>{containerLocation}</td>
                          <td style={{padding: 12}}>{containerName}</td>
                          <td style={{padding: 12}}>
                            <span style={{
                              padding: '2px 8px',
                              background: '#dbeafe',
                              color: '#1e40af',
                              borderRadius: 4,
                              fontSize: 12,
                              fontWeight: 600
                            }}>
                              {s.position || '-'}
                            </span>
                          </td>
                          <td style={{padding: 12}}>
                            {s.is_checked_out ? (
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                background: '#fef3c7',
                                color: '#92400e',
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 500
                              }}>
                                Checked Out
                              </span>
                            ) : s.container_id ? (
                              <span style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                background: '#d1fae5',
                                color: '#065f46',
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 500
                              }}>
                                In Container
                              </span>
                            ) : (
                              <span className="muted">-</span>
                            )}
                          </td>
                          <td style={{padding: 12}}>
                            {tagItems.length > 0 ? (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                {tagItems.map((tag: any) => {
                                  const color = tag.color || '#94a3b8'
                                  return (
                                    <span
                                      key={tag.id}
                                      style={{
                                        padding: '2px 8px',
                                        background: `${color}22`,
                                        color: color,
                                        borderRadius: 9999,
                                        fontSize: 12,
                                        fontWeight: 600
                                      }}
                                    >
                                      {tag.name}
                                    </span>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="muted">-</span>
                            )}
                          </td>
                          <td style={{padding: 12}}>
                            {s.container_id && (
                              <button
                                className="btn ghost"
                                onClick={handleSampleClick}
                                style={{fontSize: 12, padding: '4px 8px'}}
                              >
                                View in Container
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {!loadingSamples && filteredSamples && filteredSamples.length > samplesPerPage && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
                marginTop: 16
              }}>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: '6px 12px',
                    background: currentPage === 1 ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: currentPage === 1 ? '#9ca3af' : '#374151'
                  }}
                >
                  Previous
                </button>
                <span className="muted" style={{fontSize: 13}}>
                  Page {currentPage} of {Math.ceil(filteredSamples.length / samplesPerPage)}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredSamples.length / samplesPerPage), p + 1))}
                  disabled={currentPage >= Math.ceil(filteredSamples.length / samplesPerPage)}
                  style={{
                    padding: '6px 12px',
                    background: currentPage >= Math.ceil(filteredSamples.length / samplesPerPage) ? '#f3f4f6' : 'white',
                    border: '1px solid #d1d5db',
                    borderRadius: 6,
                    cursor: currentPage >= Math.ceil(filteredSamples.length / samplesPerPage) ? 'not-allowed' : 'pointer',
                    fontSize: 13,
                    color: currentPage >= Math.ceil(filteredSamples.length / samplesPerPage) ? '#9ca3af' : '#374151'
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {route === '#/admin' && (
          <AdminDashboard />
        )}

        {route === '#/worklist' && (
          <WorklistManager />
        )}
      </div>
    </div>
  )
}
