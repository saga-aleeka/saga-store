import React, {useEffect, useState} from 'react'
import { Toaster } from 'sonner'
import Header from './components/HeaderBar'
import ContainerFilters from './components/ContainerFilters'
import ContainerCard from './components/ContainerCard'
import AdminDashboard from './components/AdminDashboard'
import ContainerDetails from './components/ContainerDetails'
import ContainerCreateDrawer from './components/ContainerCreateDrawer'
import LoginModal from './components/LoginModal'
import WorklistManager from './components/WorklistManager'
import WorklistContainerView from './components/WorklistContainerView'
import CommandPalette from './components/CommandPalette'
import { supabase } from './lib/api'
import { getUser } from './lib/auth'
import { formatDateTime, formatDate } from './lib/dateUtils'
import { SAMPLE_TYPES } from './constants'
import { useDebounce, useRecentItems, useKeyboardShortcut } from './lib/hooks'
import { GridSkeleton } from './components/Skeletons'
import { formatErrorMessage } from './lib/utils'

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
  // filters
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [availableOnly, setAvailableOnly] = useState(false)
  const [trainingOnly, setTrainingOnly] = useState(false)
  // pagination for samples
  const [samplesPerPage, setSamplesPerPage] = useState(24)
  const [currentPage, setCurrentPage] = useState(1)
  // pagination for containers
  const [containersPerPage, setContainersPerPage] = useState(24)
  const [containersCurrentPage, setContainersCurrentPage] = useState(1)
  // search
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebounce(searchQuery, 300)
  // sample type filters for samples page
  const [sampleTypeFilters, setSampleTypeFilters] = useState<string[]>([])
  // bulk selection for samples
  const [selectedSampleIds, setSelectedSampleIds] = useState<Set<string>>(new Set())
  const [bulkActionInProgress, setBulkActionInProgress] = useState(false)
  
  // Recent items tracking
  const { recentItems: recentContainers, addRecentItem: addRecentContainer } = useRecentItems<{ id: string; name: string }>(
    'saga_recent_containers',
    10
  )
  
  // Command palette state
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  
  // Grid keyboard navigation state
  const [focusedContainerIndex, setFocusedContainerIndex] = useState<number>(-1)
  
  // Cmd+K keyboard shortcut for command palette
  useKeyboardShortcut({
    key: 'k',
    meta: true,
    handler: (e) => {
      e.preventDefault()
      setCommandPaletteOpen(true)
    }
  })

  // Clear all filters function
  const clearAllFilters = () => {
    setSelectedTypes([])
    setAvailableOnly(false)
    setTrainingOnly(false)
    setSampleTypeFilters([])
    setSearchQuery('')
  }

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1)
    setContainersCurrentPage(1)
  }, [debouncedSearchQuery])

  // Reset containers page when filters change
  useEffect(() => {
    setContainersCurrentPage(1)
  }, [selectedTypes, availableOnly, trainingOnly])

  // Reset containers page when route changes
  useEffect(() => {
    setContainersCurrentPage(1)
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
        if (!samples) setSamples(new Array(count || 0))
      } catch(e) {
        console.warn('failed to load samples count', e)
      }
    }
    
    loadContainersCount()
    loadArchivedCount()
    loadSamplesCount()
    
    return () => { mounted = false }
  }, [route])

  useEffect(() => {
    // load containers when on containers route
    let mounted = true
    async function load(){
      setLoadingContainers(true)
      try{
        const { data, error } = await supabase
          .from('containers')
          .select('*, samples!samples_container_id_fkey(*)')
          .eq('archived', false)
          .order('updated_at', { ascending: false })
        
        if (!mounted) return
        if (error) throw error
        
        // Count all samples (including archived) for each container
        const containersWithCounts = (data ?? []).map((c: any) => {
          const sampleCount = (c.samples || []).length
          console.log(`Container ${c.name}: ${sampleCount} samples (including archived)`, c.samples)
          return {
            ...c,
            used: sampleCount
          }
        })
        
        setContainers(containersWithCounts)
      }catch(e){
        console.warn('failed to load containers', e)
        if (mounted) setContainers([])
      }finally{ if (mounted) setLoadingContainers(false) }
    }

    if (route === '#/containers') load()
    return () => { mounted = false }
  }, [route])
  
  // Keyboard navigation for container grid
  useEffect(() => {
    if (route !== '#/containers' || commandPaletteOpen) return
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't interfere with input fields
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }
      
      const currentPageContainers = filteredContainers.slice(
        (containersCurrentPage - 1) * containersPerPage,
        containersCurrentPage * containersPerPage
      )
      
      if (currentPageContainers.length === 0) return
      
      // Calculate grid columns (same logic as CSS)
      const width = window.innerWidth
      let columns = Math.floor(width / 280) // minmax(280px, 1fr)
      if (width >= 1024) columns = Math.floor(width / 320)
      if (width <= 768) columns = Math.floor(width / 240)
      if (width <= 640) columns = 1
      columns = Math.max(1, columns)
      
      let newIndex = focusedContainerIndex
      
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        newIndex = focusedContainerIndex === -1 ? 0 : Math.min(focusedContainerIndex + 1, currentPageContainers.length - 1)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        newIndex = focusedContainerIndex === -1 ? 0 : Math.max(focusedContainerIndex - 1, 0)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (focusedContainerIndex === -1) {
          newIndex = 0
        } else {
          const nextRow = focusedContainerIndex + columns
          newIndex = Math.min(nextRow, currentPageContainers.length - 1)
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (focusedContainerIndex === -1) {
          newIndex = 0
        } else {
          const prevRow = focusedContainerIndex - columns
          newIndex = Math.max(prevRow, 0)
        }
      } else if (e.key === 'Enter' && focusedContainerIndex >= 0 && focusedContainerIndex < currentPageContainers.length) {
        e.preventDefault()
        const container = currentPageContainers[focusedContainerIndex]
        window.location.hash = `#/containers/${container.id}`
        return
      }
      
      setFocusedContainerIndex(newIndex)
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [route, focusedContainerIndex, filteredContainers, containersCurrentPage, containersPerPage, commandPaletteOpen])
  
  // Reset focused index when page changes
  useEffect(() => {
    setFocusedContainerIndex(-1)
  }, [containersCurrentPage, route])

  // apply filters client-side to containers list
  const filteredContainers = React.useMemo(() => {
    if (!containers) return []
    let filtered = containers.filter((c:any) => {
      // sample type filter (if any selected)
      if (selectedTypes && selectedTypes.length){
        if (!selectedTypes.includes(c.type)) return false
      }
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
    
    // Apply search filter with debounced value
    if (debouncedSearchQuery.trim()) {
      const terms = debouncedSearchQuery.split(',').map(t => t.trim().toLowerCase()).filter(t => t)
      filtered = filtered.filter((c: any) => {
        const searchText = `${c.id || ''} ${c.name || ''} ${c.location || ''}`.toLowerCase()
        return terms.some(term => searchText.includes(term))
      })
    }
    
    return filtered
  }, [containers, selectedTypes, availableOnly, trainingOnly, debouncedSearchQuery])

  useEffect(() => {
    async function onUpdated(e: any){
      // refresh both lists when a container is updated (might be archived/unarchived)
      try {
        const [activeRes, archivedRes] = await Promise.all([
          supabase
            .from('containers')
            .select('*, samples!samples_container_id_fkey(*)')
            .eq('archived', false)
            .order('updated_at', { ascending: false }),
          supabase
            .from('containers')
            .select('*, samples!samples_container_id_fkey(*)')
            .eq('archived', true)
            .order('updated_at', { ascending: false })
        ])
        
        if (activeRes.data) {
          const containersWithCounts = activeRes.data.map((c: any) => ({
            ...c,
            used: (c.samples || []).length
          }))
          setContainers(containersWithCounts)
        }
        
        if (archivedRes.data) {
          const containersWithCounts = archivedRes.data.map((c: any) => ({
            ...c,
            used: (c.samples || []).length
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
        const { data, error } = await supabase
          .from('containers')
          .select('*, samples!samples_container_id_fkey(*)')
          .eq('archived', true)
          .order('updated_at', { ascending: false })
        
        if (!mounted) return
        if (error) {
          console.error('Failed to load archived containers:', error)
          throw error
        }
        
        console.log('Loaded archived containers:', data)
        
        // Count all samples (including archived) for each container
        const containersWithCounts = (data ?? []).map((c: any) => ({
          ...c,
          used: (c.samples || []).length
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
    // load samples when on samples route or archive route
    let mounted = true
    async function loadSamples(){
      setLoadingSamples(true)
      try{
        const isArchiveRoute = route === '#/archive'
        const { data, error } = await supabase
          .from('samples')
          .select(`
            *, 
            containers!samples_container_id_fkey(id, name, location, type),
            previous_containers:containers!samples_previous_container_id_fkey(id, name, location, type)
          `, { count: 'exact' })
          .eq('is_archived', isArchiveRoute ? true : false)
          .order('created_at', { ascending: false })
          .range(0, 999999)
        
        if (!mounted) return
        if (error) throw error
        setSamples(data ?? [])
        setCurrentPage(1) // Reset to first page when reloading
      }catch(e){
        console.warn('failed to load samples', e)
        if (mounted) setSamples([])
      }finally{ if (mounted) setLoadingSamples(false) }
    }

    if (route === '#/samples' || route === '#/archive') loadSamples()
    return () => { mounted = false }
  }, [route])

  // Apply search filter and type filter to samples
  const filteredSamples = React.useMemo(() => {
    if (!samples) return []
    let filtered = samples
    
    // Apply type filter
    if (sampleTypeFilters.length > 0) {
      filtered = filtered.filter((s: any) => {
        // For checked out samples, use previous container type; otherwise use current container type
        const containerType = s.is_checked_out && s.previous_containers?.type
          ? s.previous_containers.type
          : (s.containers?.type || 'Sample Type')
        return sampleTypeFilters.includes(containerType)
      })
    }
    
    // Apply search filter with debounced value
    if (debouncedSearchQuery.trim()) {
      const terms = debouncedSearchQuery.split(',').map(t => t.trim().toLowerCase()).filter(t => t)
      filtered = filtered.filter((s: any) => {
        const checkedOutText = s.is_checked_out ? 'checked out' : ''
        const checkedOutByMe = s.is_checked_out && user && s.checked_out_by === user.initials ? 'mine' : ''
        const searchText = `${s.sample_id || ''} ${s.containers?.name || ''} ${s.containers?.location || ''} ${s.position || ''} ${checkedOutText} ${checkedOutByMe}`.toLowerCase()
        return terms.some(term => searchText.includes(term))
      })
    }
    
    return filtered
  }, [samples, debouncedSearchQuery, sampleTypeFilters, user])

  // Bulk action handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const currentPageSampleIds = filteredSamples
        ?.slice((currentPage - 1) * samplesPerPage, currentPage * samplesPerPage)
        .map(s => s.id) || []
      setSelectedSampleIds(new Set(currentPageSampleIds))
    } else {
      setSelectedSampleIds(new Set())
    }
  }

  const handleSelectSample = (sampleId: string, checked: boolean) => {
    const newSelected = new Set(selectedSampleIds)
    if (checked) {
      newSelected.add(sampleId)
    } else {
      newSelected.delete(sampleId)
    }
    setSelectedSampleIds(newSelected)
  }

  const handleBulkArchive = async (archive: boolean) => {
    if (selectedSampleIds.size === 0) return
    
    const action = archive ? 'archive' : 'unarchive'
    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${selectedSampleIds.size} sample(s)?`
    )
    
    if (!confirmed) return
    
    setBulkActionInProgress(true)
    
    try {
      const sampleIds = Array.from(selectedSampleIds)
      let successCount = 0
      let failCount = 0
      
      for (const sampleId of sampleIds) {
        try {
          const { error } = await supabase
            .from('samples')
            .update({ is_archived: archive })
            .eq('id', sampleId)
          
          if (error) throw error
          successCount++
        } catch (e) {
          console.error(`Failed to ${action} sample:`, e)
          failCount++
        }
      }
      
      // Reload samples
      await loadSamples()
      
      // Clear selection
      setSelectedSampleIds(new Set())
      
      if (failCount === 0) {
        toast.success(`Successfully ${archive ? 'archived' : 'unarchived'} ${successCount} sample(s)`)
      } else {
        toast.warning(`${action} completed: ${successCount} succeeded, ${failCount} failed`)
      }
    } catch (error) {
      console.error('Bulk action error:', error)
      toast.error(formatErrorMessage(error, `Bulk ${action}`))
    } finally {
      setBulkActionInProgress(false)
    }
  }
  
  // Command palette navigation handler
  const handleCommandPaletteNavigate = async (type: 'container' | 'sample', id: string) => {
    if (type === 'container') {
      // Add to recent containers
      try {
        const { data } = await supabase
          .from('containers')
          .select('id, name')
          .eq('id', id)
          .single()
        
        if (data) {
          addRecentContainer({ id: data.id, name: data.name })
        }
      } catch (e) {
        console.error('Failed to fetch container for recent items:', e)
      }
      
      // Navigate to container
      window.location.hash = `#/containers/${id}`
    } else if (type === 'sample') {
      // Navigate to the sample's container
      try {
        const { data } = await supabase
          .from('samples')
          .select('container_id, containers(id, name)')
          .eq('id', id)
          .single()
        
        if (data && data.container_id) {
          const container = data.containers as any
          if (container) {
            addRecentContainer({ id: container.id, name: container.name })
          }
          window.location.hash = `#/containers/${data.container_id}`
        }
      } catch (e) {
        console.error('Failed to navigate to sample:', e)
        toast.error(formatErrorMessage(e, 'Navigate to sample'))
      }
    }
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
        <Header route="#/worklist" user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samples?.length ?? 0} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
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

  // container detail route: #/containers/:id
  if (route.startsWith('#/containers/') && route.split('/').length >= 3) {
    const parts = route.split('/')
    const idWithQuery = decodeURIComponent(parts[2])
    const id = idWithQuery.split('?')[0]
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samples?.length ?? 0} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{marginTop:18}}>
          <ContainerDetails id={id} />
        </div>
      </div>
    )
  }

  if (route === '#/new'){
    return (
      <div className="app">
        <Header route={route} user={user} onSignOut={signOut} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samples?.length ?? 0} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div style={{marginTop:18}}>
          <ContainerCreateDrawer onClose={() => { window.location.hash = '#/containers' }} />
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <Toaster 
        position="top-right" 
        expand={false}
        richColors
        closeButton
      />
      
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        recentContainers={recentContainers}
        onNavigate={handleCommandPaletteNavigate}
      />
      
      <Header route={route} user={user} onSignOut={signOut} isAdmin={route === '#/admin'} onExitAdmin={() => { window.location.hash = '#/containers' }} containersCount={containers?.length ?? 0} archivedCount={archivedContainers?.length ?? 0} samplesCount={samples?.length ?? 0} searchQuery={searchQuery} onSearchChange={setSearchQuery} />

      {!user && (
        <LoginModal onSuccess={(u:any) => setUser(u)} />
      )}

      <div style={{marginTop:18}}>
        {route === '#/containers' && (
          <>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8}}>
              <div className="muted">
                Showing {filteredContainers ? `${Math.min((containersCurrentPage - 1) * containersPerPage + 1, filteredContainers.length)}-${Math.min(containersCurrentPage * containersPerPage, filteredContainers.length)} of ${filteredContainers.length}` : '...'} active containers
              </div>
              <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <span className="muted" style={{fontSize: 13}}>Per page:</span>
                {[24, 48, 96].map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      setContainersPerPage(size)
                      setContainersCurrentPage(1)
                    }}
                    style={{
                      padding: '4px 12px',
                      background: containersPerPage === size ? '#3b82f6' : 'white',
                      color: containersPerPage === size ? 'white' : '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: containersPerPage === size ? 600 : 400
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            {/* Filters */}
            <div style={{marginTop:8, display: 'flex', gap: 12, alignItems: 'flex-start'}}>
              <div style={{flex: 1}}>
                <ContainerFilters selected={selectedTypes} onChange={(s:any)=> setSelectedTypes(s)} availableOnly={availableOnly} onAvailableChange={setAvailableOnly} trainingOnly={trainingOnly} onTrainingChange={setTrainingOnly} />
              </div>
              {(selectedTypes.length > 0 || availableOnly || trainingOnly || searchQuery.trim()) && (
                <button
                  onClick={clearAllFilters}
                  className="btn ghost"
                  style={{
                    padding: '8px 16px',
                    fontSize: 14,
                    whiteSpace: 'nowrap'
                  }}
                >
                  ✕ Clear Filters
                </button>
              )}
            </div>
            <div className="container-list">
              {loadingContainers && <GridSkeleton count={containersPerPage} />}
              {!loadingContainers && filteredContainers && filteredContainers.length === 0 && (
                <div className="muted">
                  {searchQuery.trim() || selectedTypes.length > 0 || availableOnly || trainingOnly
                    ? 'No containers match your filters'
                    : 'No active containers'}
                </div>
              )}
              {!loadingContainers && filteredContainers && filteredContainers.slice((containersCurrentPage - 1) * containersPerPage, containersCurrentPage * containersPerPage).map((c, idx) => (
                <div
                  key={c.id}
                  style={{
                    outline: focusedContainerIndex === idx ? '3px solid #3b82f6' : 'none',
                    outlineOffset: '-3px',
                    borderRadius: 12,
                    transition: 'outline 0.15s'
                  }}
                  tabIndex={0}
                  onClick={() => setFocusedContainerIndex(idx)}
                  onFocus={() => setFocusedContainerIndex(idx)}
                >
                  <ContainerCard 
                    id={c.id} 
                    name={c.name} 
                    type={c.type} 
                    temperature={c.temperature} 
                    layout={c.layout} 
                    occupancy={{used:c.used,total:c.total}} 
                    updatedAt={c.updated_at} 
                    location={c.location} 
                    training={c.training}
                  />
                </div>
              ))}
            </div>
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
                {[24, 48, 96].map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      setContainersPerPage(size)
                      setContainersCurrentPage(1)
                    }}
                    style={{
                      padding: '4px 12px',
                      background: containersPerPage === size ? '#3b82f6' : 'white',
                      color: containersPerPage === size ? 'white' : '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: containersPerPage === size ? 600 : 400
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <div className="container-list">
              {loadingArchived && <div className="muted">Loading archived containers...</div>}
              {!loadingArchived && archivedContainers && archivedContainers.length === 0 && <div className="muted">No archived containers</div>}
              {!loadingArchived && archivedContainers && archivedContainers.slice((containersCurrentPage - 1) * containersPerPage, containersCurrentPage * containersPerPage).map((c:any) => (
                <ContainerCard key={c.id} id={c.id} name={c.name} type={c.type} temperature={c.temperature} layout={c.layout} occupancy={{used:c.used,total:c.total}} updatedAt={c.updated_at} location={c.location} training={c.training} archived={c.archived} />
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
                    const containerLocation = s.containers?.location || 'Location unknown'
                    
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

        {route === '#/samples' && (
          <div>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12}}>
              <div className="muted">
                Showing {filteredSamples ? `${Math.min((currentPage - 1) * samplesPerPage + 1, filteredSamples.length)}-${Math.min(currentPage * samplesPerPage, filteredSamples.length)} of ${filteredSamples.length}` : '...'} samples
              </div>
              <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                <span className="muted" style={{fontSize: 13}}>Per page:</span>
                {[24, 48, 96].map(size => (
                  <button
                    key={size}
                    onClick={() => {
                      setSamplesPerPage(size)
                      setCurrentPage(1)
                    }}
                    style={{
                      padding: '4px 12px',
                      background: samplesPerPage === size ? '#3b82f6' : 'white',
                      color: samplesPerPage === size ? 'white' : '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: samplesPerPage === size ? 600 : 400
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Sample Type Filters */}
            {(() => {
              const availableSampleTypes = samples ? Array.from(new Set(samples.map((s: any) => {
                // For checked out samples, use previous container type; otherwise use current container type
                return s.is_checked_out && s.previous_containers?.type
                  ? s.previous_containers.type
                  : (s.containers?.type || 'Sample Type')
              }))).filter(type => type !== 'Sample Type').sort() : []
              
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
            
            {loadingSamples && <div className="muted">Loading samples...</div>}
            {!loadingSamples && filteredSamples && filteredSamples.length === 0 && <div className="muted">No samples found</div>}
            
            {/* Bulk action toolbar */}
            {!loadingSamples && filteredSamples && filteredSamples.length > 0 && (
              <div style={{
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: 12,
                background: selectedSampleIds.size > 0 ? '#f0f9ff' : '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: 8
              }}>
                <div style={{fontSize: 14, color: '#374151', fontWeight: 500}}>
                  {selectedSampleIds.size > 0 
                    ? `${selectedSampleIds.size} sample(s) selected` 
                    : 'Select samples for bulk actions'}
                </div>
                {selectedSampleIds.size > 0 && (
                  <>
                    <button
                      onClick={() => handleBulkArchive(true)}
                      disabled={bulkActionInProgress}
                      style={{
                        padding: '8px 16px',
                        fontSize: 13,
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: 6,
                        background: '#fbbf24',
                        color: 'white',
                        cursor: bulkActionInProgress ? 'not-allowed' : 'pointer',
                        opacity: bulkActionInProgress ? 0.6 : 1
                      }}
                    >
                      Archive Selected
                    </button>
                    <button
                      onClick={() => handleBulkArchive(false)}
                      disabled={bulkActionInProgress}
                      style={{
                        padding: '8px 16px',
                        fontSize: 13,
                        fontWeight: 600,
                        border: 'none',
                        borderRadius: 6,
                        background: '#10b981',
                        color: 'white',
                        cursor: bulkActionInProgress ? 'not-allowed' : 'pointer',
                        opacity: bulkActionInProgress ? 0.6 : 1
                      }}
                    >
                      Unarchive Selected
                    </button>
                    <button
                      onClick={() => setSelectedSampleIds(new Set())}
                      disabled={bulkActionInProgress}
                      style={{
                        padding: '8px 16px',
                        fontSize: 13,
                        fontWeight: 500,
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        background: 'white',
                        color: '#374151',
                        cursor: bulkActionInProgress ? 'not-allowed' : 'pointer',
                        opacity: bulkActionInProgress ? 0.6 : 1
                      }}
                    >
                      Clear Selection
                    </button>
                  </>
                )}
              </div>
            )}
            
            {/* Paginated samples table */}
            {!loadingSamples && filteredSamples && filteredSamples.length > 0 && (
              <div style={{border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden'}}>
                <table style={{width: '100%', borderCollapse: 'collapse'}}>
                  <thead style={{background: '#f3f4f6'}}>
                    <tr>
                      <th style={{padding: 12, width: 40}}>
                        <input
                          type="checkbox"
                          checked={selectedSampleIds.size > 0 && selectedSampleIds.size === Math.min(samplesPerPage, filteredSamples.length - (currentPage - 1) * samplesPerPage)}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          style={{cursor: 'pointer', width: 16, height: 16}}
                        />
                      </th>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '25%'}}>Sample ID</th>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '15%'}}>Container Type</th>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '25%'}}>Container</th>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '15%'}}>Location</th>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '10%'}}>Position</th>
                      <th style={{padding: 12, textAlign: 'left', fontWeight: 600, width: '10%'}}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSamples.slice((currentPage - 1) * samplesPerPage, currentPage * samplesPerPage).map((s: any, index: number) => {
                      const handleSampleClick = () => {
                        window.location.hash = `#/containers/${s.container_id}?highlight=${encodeURIComponent(s.position)}&returnTo=samples`
                      }
                      
                      const containerName = s.containers?.name || s.container_id || '-'
                      const containerLocation = s.containers?.location || '-'
                      // For checked out samples, use previous container type; otherwise use current container type
                      const containerType = s.is_checked_out && s.previous_containers?.type
                        ? s.previous_containers.type
                        : (s.containers?.type || 'Sample Type')
                      const typeColor = SAMPLE_TYPE_COLORS[containerType] || '#6b7280'
                      const isCheckedOutByMe = s.is_checked_out && user && s.checked_out_by === user.initials
                      
                      return (
                        <tr 
                          key={s.id}
                          style={{
                            borderTop: index > 0 ? '1px solid #e5e7eb' : 'none',
                            background: selectedSampleIds.has(s.id) ? '#eff6ff' : 'white'
                          }}
                        >
                          <td style={{padding: 12}} onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedSampleIds.has(s.id)}
                              onChange={(e) => handleSelectSample(s.id, e.target.checked)}
                              style={{cursor: 'pointer', width: 16, height: 16}}
                            />
                          </td>
                          <td style={{padding: 12, fontWeight: 600}}>
                            {s.sample_id}
                            {isCheckedOutByMe && (
                              <span style={{
                                marginLeft: 8,
                                padding: '3px 8px',
                                fontSize: 11,
                                borderRadius: 12,
                                background: '#f3e8ff',
                                color: '#7c3aed',
                                fontWeight: 600,
                                border: '1px solid #e9d5ff'
                              }}>
                                ✓ MY CHECKOUT
                              </span>
                            )}
                            {s.is_checked_out && !isCheckedOutByMe && (
                              <span style={{
                                marginLeft: 8,
                                padding: '3px 8px',
                                fontSize: 11,
                                borderRadius: 12,
                                background: '#fee2e2',
                                color: '#991b1b',
                                fontWeight: 600
                              }}>
                                CHECKED OUT
                              </span>
                            )}
                            {s.is_archived && (
                              <span style={{
                                marginLeft: 8,
                                padding: '3px 8px',
                                fontSize: 11,
                                borderRadius: 12,
                                background: '#fef3c7',
                                color: '#92400e',
                                fontWeight: 600
                              }}>
                                ARCHIVED
                              </span>
                            )}
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
                          <td style={{padding: 12}}>{containerName}</td>
                          <td style={{padding: 12}}>{containerLocation}</td>
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
                            {s.container_id && (
                              <button
                                className="btn ghost"
                                onClick={handleSampleClick}
                                style={{fontSize: 12, padding: '4px 8px'}}
                              >
                                View
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
