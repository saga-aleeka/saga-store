import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/api'
import { getUser } from '../lib/auth'
import { CONTAINER_LOCATION_SELECT, formatContainerLocation } from '../lib/locationUtils'
import { formatDate } from '../lib/dateUtils'
import { TEMPS } from '../constants'
import LocationBreadcrumb from './LocationBreadcrumb'
import ContainerCreateDrawer from './ContainerCreateDrawer'

export default function ColdStorageDetails({ id }: { id: string }) {
  const INTERIOR_IMAGE_BUCKET = 'cold-storage-interiors'
  const INTERIOR_IMAGE_TTL_SECONDS = 50 * 60
  const INTERIOR_IMAGE_REFRESH_MS = 45 * 60 * 1000
  const [unit, setUnit] = useState<any | null>(null)
  const [racks, setRacks] = useState<any[]>([])
  const [containers, setContainers] = useState<any[]>([])
  const [shelves, setShelves] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [shelfForm, setShelfForm] = useState({ name: '', position: '' })
  const [itemForms, setItemForms] = useState<
    Record<
      string,
      {
        item_type: 'container' | 'reagent' | 'other' | 'rack'
        item_id: string
        lot_id: string
        description: string
        quantity: string
        container_id: string
        rack_id: string
        search: string
        rack_search: string
        item_color: string
      }
    >
  >({})
  const [savingShelf, setSavingShelf] = useState(false)
  const [savingItem, setSavingItem] = useState<Record<string, boolean>>({})
  const [editForm, setEditForm] = useState<any | null>(null)
  const [savingUnit, setSavingUnit] = useState(false)
  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const [contentsView, setContentsView] = useState<'shelves' | 'list'>('shelves')
  const [showContentsMenu, setShowContentsMenu] = useState(false)
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({})
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [createDrawerName, setCreateDrawerName] = useState('')
  const [containerDropdownOpen, setContainerDropdownOpen] = useState<Record<string, boolean>>({})
  const [rackDropdownOpen, setRackDropdownOpen] = useState<Record<string, boolean>>({})
  const [containerSearchResults, setContainerSearchResults] = useState<Record<string, any[]>>({})
  const [containerSearchLoading, setContainerSearchLoading] = useState<Record<string, boolean>>({})
  const containerSearchTimeouts = useRef<Record<string, number>>({})
  const [rackSearchResults, setRackSearchResults] = useState<Record<string, any[]>>({})
  const [rackSearchLoading, setRackSearchLoading] = useState<Record<string, boolean>>({})
  const rackSearchTimeouts = useRef<Record<string, number>>({})
  const [interiorImageUrl, setInteriorImageUrl] = useState<string | null>(null)
  const [interiorImageFileName, setInteriorImageFileName] = useState('')
  const [showBulkDrawer, setShowBulkDrawer] = useState(false)
  const [bulkForm, setBulkForm] = useState({
    item_id: '',
    lot_id: '',
    description: '',
    quantity: '',
    status: ''
  })
  const [savingBulk, setSavingBulk] = useState(false)
  const [dragItemId, setDragItemId] = useState<string | null>(null)
  const [dragOverShelfId, setDragOverShelfId] = useState<string | null>(null)
  const [dragOverItem, setDragOverItem] = useState<{ shelfId: string; itemId: string; position: 'before' | 'after' } | null>(null)
  const [itemOrderByShelf, setItemOrderByShelf] = useState<Record<string, string[]>>({})
  const [activeShelfMenuId, setActiveShelfMenuId] = useState<string | null>(null)
  const [editingShelfId, setEditingShelfId] = useState<string | null>(null)
  const [openItemMenuId, setOpenItemMenuId] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<any | null>(null)
  const [itemEditForm, setItemEditForm] = useState({
    item_id: '',
    lot_id: '',
    description: '',
    quantity: '',
    status: ''
  })
  const [savingItemEdit, setSavingItemEdit] = useState(false)
  const [showMoveDrawer, setShowMoveDrawer] = useState(false)
  const [moveTargetId, setMoveTargetId] = useState('')
  const [storageOptions, setStorageOptions] = useState<any[]>([])
  const [loadingMoveOptions, setLoadingMoveOptions] = useState(false)
  const [rackForm, setRackForm] = useState({ name: '', position: '', grid_rows: '', grid_cols: '' })
  const [savingRack, setSavingRack] = useState(false)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const [
          { data: unitData, error: unitError },
          { data: rackData, error: rackError },
          { data: containerData, error: containerError },
          { data: shelfData, error: shelfError }
        ] = await Promise.all([
          supabase.from('cold_storage_units').select('*').eq('id', id).single(),
          supabase.from('racks').select('*').eq('cold_storage_id', id).order('name', { ascending: true }),
          supabase
            .from('containers')
            .select(CONTAINER_LOCATION_SELECT)
            .eq('cold_storage_id', id)
            .eq('archived', false)
            .order('updated_at', { ascending: false }),
          supabase.from('cold_storage_shelves').select('*').eq('cold_storage_id', id).order('name', { ascending: true })
        ])

        if (unitError) throw unitError
        if (rackError) throw rackError
        if (containerError) throw containerError
        if (shelfError) throw shelfError

        let itemData: any[] = []
        const { data: orderedItems, error: orderedItemsError } = await supabase
          .from('cold_storage_items')
          .select('*')
          .eq('cold_storage_id', id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false })

        if (orderedItemsError && /sort_order/i.test(orderedItemsError.message || '')) {
          const { data: fallbackItems, error: fallbackError } = await supabase
            .from('cold_storage_items')
            .select('*')
            .eq('cold_storage_id', id)
            .order('created_at', { ascending: false })

          if (fallbackError) throw fallbackError
          itemData = fallbackItems || []
        } else if (orderedItemsError) {
          throw orderedItemsError
        } else {
          itemData = orderedItems || []
        }

        if (!mounted) return
        setUnit(unitData || null)
        setEditForm(unitData || null)
        setRacks(rackData || [])
        setContainers(containerData || [])
        setShelves(shelfData || [])
        setItems(itemData || [])
      } catch (e) {
        console.error('Failed to load cold storage details:', e)
        if (mounted) {
          setUnit(null)
          setRacks([])
          setContainers([])
          setShelves([])
          setItems([])
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [id])

  useEffect(() => {
    let active = true
    const loadInteriorImage = async () => {
      if (!unit?.interior_image_path) {
        if (active) setInteriorImageUrl(null)
        return
      }
      const { data, error } = await supabase
        .storage
        .from(INTERIOR_IMAGE_BUCKET)
        .createSignedUrl(unit.interior_image_path, INTERIOR_IMAGE_TTL_SECONDS)
      if (!active) return
      if (error) {
        console.warn('Failed to load interior image', error)
        setInteriorImageUrl(null)
        return
      }
      setInteriorImageUrl(data?.signedUrl || null)
    }

    loadInteriorImage()
    const refreshId = window.setInterval(() => {
      loadInteriorImage()
    }, INTERIOR_IMAGE_REFRESH_MS)
    return () => {
      window.clearInterval(refreshId)
      active = false
    }
  }, [unit?.interior_image_path])

  const breadcrumbItems = unit ? [{ label: unit.name }] : []

  const shelvesWithItems = shelves.map((shelf) => ({
    ...shelf,
    items: items.filter((item) => item.shelf_id === shelf.id)
  }))
  const shelfNameById = shelves.reduce<Record<string, string>>((acc, shelf) => {
    acc[shelf.id] = shelf.name
    return acc
  }, {})

  const SAMPLE_TYPE_COLORS: Record<string, string> = {
    'PA Pools': '#fb923c',
    'DP Pools': '#10b981',
    'cfDNA Tubes': '#9ca3af',
    'DTC Tubes': '#7c3aed',
    'MNC Tubes': '#ef4444',
    'Plasma Tubes': '#f59e0b',
    'BC Tubes': '#3b82f6',
    'IDT Plates': '#06b6d4'
  }

  const addAlpha = (hex: string, alpha: string) => {
    if (!hex.startsWith('#') || hex.length !== 7) return hex
    return `${hex}${alpha}`
  }

  const containerById = containers.reduce<Record<string, any>>((acc, container) => {
    acc[container.id] = container
    return acc
  }, {})

  const rackById = racks.reduce<Record<string, any>>((acc, rack) => {
    acc[rack.id] = rack
    return acc
  }, {})

  const getBadgeColors = (item: any) => {
    if (item.item_type === 'container') {
      const container = containerById[item.container_id]
      if (container?.is_rnd) return { border: '#06b6d4', bg: addAlpha('#06b6d4', '22'), text: '#0f766e' }
      const base = SAMPLE_TYPE_COLORS[container?.type] || '#94a3b8'
      return { border: base, bg: addAlpha(base, '22'), text: base }
    }
    if (item.item_type === 'rack') {
      const rack = rackById[item.rack_id]
      const base = SAMPLE_TYPE_COLORS[rack?.name] || '#94a3b8'
      return { border: base, bg: addAlpha(base, '22'), text: base }
    }
    if (item.item_type === 'reagent') {
      const base = item.item_color || DEFAULT_REAGENT_COLOR
      return { border: base, bg: addAlpha(base, '22'), text: base }
    }
    if (item.item_type === 'other') {
      const base = item.item_color || DEFAULT_OTHER_COLOR
      return { border: base, bg: addAlpha(base, '22'), text: base }
    }
    return { border: '#e5e7eb', bg: '#ffffff', text: '#0f172a' }
  }

  useEffect(() => {
    setItemOrderByShelf((prev) => {
      const next: Record<string, string[]> = { ...prev }
      shelves.forEach((shelf) => {
        const shelfItems = items
          .filter((item) => item.shelf_id === shelf.id)
          .sort((a, b) => {
            if (a.sort_order == null && b.sort_order == null) return 0
            if (a.sort_order == null) return 1
            if (b.sort_order == null) return -1
            return a.sort_order - b.sort_order
          })
          .map((item) => item.id)
        const existing = next[shelf.id] || []
        const filtered = existing.filter((id) => shelfItems.includes(id))
        const missing = shelfItems.filter((id) => !filtered.includes(id))
        next[shelf.id] = [...filtered, ...missing]
      })
      return next
    })
  }, [items, shelves])

  const handleShelfInput = (key: 'name' | 'position', value: string) => {
    setShelfForm((prev) => ({ ...prev, [key]: value }))
  }

  const DEFAULT_REAGENT_COLOR = '#A3B18A'
  const DEFAULT_OTHER_COLOR = '#D6A36A'

  const handleItemInput = (
    shelfId: string,
    key: 'item_type' | 'item_id' | 'lot_id' | 'description' | 'quantity' | 'container_id' | 'search' | 'rack_search' | 'item_color',
    value: string
  ) => {
    setItemForms((prev) => {
      const current = prev[shelfId] || {
        item_type: 'reagent',
        item_id: '',
        lot_id: '',
        description: '',
        quantity: '',
        container_id: '',
        rack_id: '',
        search: '',
        rack_search: '',
        item_color: DEFAULT_REAGENT_COLOR
      }
      if (key === 'item_type') {
        const nextType = value as 'container' | 'reagent' | 'other' | 'rack'
        return {
          ...prev,
          [shelfId]: {
            ...current,
            item_type: nextType,
            item_color:
              nextType === 'reagent'
                ? DEFAULT_REAGENT_COLOR
                : nextType === 'other'
                  ? DEFAULT_OTHER_COLOR
                  : ''
          }
        }
      }
      return {
        ...prev,
        [shelfId]: { ...current, [key]: value }
      }
    })
  }

  const runContainerSearch = async (shelfId: string, query: string) => {
    setContainerSearchLoading((prev) => ({ ...prev, [shelfId]: true }))
    try {
      const trimmed = query.trim()
      let request = supabase
        .from('containers')
        .select(CONTAINER_LOCATION_SELECT)
        .eq('archived', false)

      if (unit?.id) request = request.eq('cold_storage_id', unit.id)

      if (trimmed) {
        const escaped = trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_')
        request = request.or(`name.ilike.%${escaped}%,id.ilike.%${escaped}%`)
      }

      const { data, error } = await request.order('updated_at', { ascending: false })
      if (error) throw error
      setContainerSearchResults((prev) => ({ ...prev, [shelfId]: data || [] }))
    } catch (e) {
      console.warn('Failed to search containers', e)
    } finally {
      setContainerSearchLoading((prev) => ({ ...prev, [shelfId]: false }))
    }
  }

  const queueContainerSearch = (shelfId: string, query: string) => {
    const existing = containerSearchTimeouts.current[shelfId]
    if (existing) window.clearTimeout(existing)
    containerSearchTimeouts.current[shelfId] = window.setTimeout(() => {
      runContainerSearch(shelfId, query)
    }, 250)
  }

  const runRackSearch = async (shelfId: string, query: string) => {
    setRackSearchLoading((prev) => ({ ...prev, [shelfId]: true }))
    try {
      const trimmed = query.trim()
      let request = supabase.from('racks').select('*')

      if (trimmed) {
        const escaped = trimmed.replace(/%/g, '\\%').replace(/_/g, '\\_')
        request = request.or(`name.ilike.%${escaped}%,position.ilike.%${escaped}%`)
      }

      const { data, error } = await request.order('name', { ascending: true })
      if (error) throw error
      setRackSearchResults((prev) => ({ ...prev, [shelfId]: data || [] }))
    } catch (e) {
      console.warn('Failed to search racks', e)
    } finally {
      setRackSearchLoading((prev) => ({ ...prev, [shelfId]: false }))
    }
  }

  const queueRackSearch = (shelfId: string, query: string) => {
    const existing = rackSearchTimeouts.current[shelfId]
    if (existing) window.clearTimeout(existing)
    rackSearchTimeouts.current[shelfId] = window.setTimeout(() => {
      runRackSearch(shelfId, query)
    }, 250)
  }

  const handleAddShelf = async () => {
    if (!shelfForm.name.trim()) return
    setSavingShelf(true)
    try {
      const { data, error } = await supabase
        .from('cold_storage_shelves')
        .insert([
          {
            cold_storage_id: unit.id,
            name: shelfForm.name.trim(),
            position: shelfForm.position.trim() || null
          }
        ])
        .select()

      if (error) throw error
      setShelves((prev) => [...(prev || []), ...(data || [])])
      setShelfForm({ name: '', position: '' })
    } catch (e) {
      console.error('Failed to add shelf:', e)
      alert('Failed to add shelf')
    } finally {
      setSavingShelf(false)
    }
  }

  const handleAddItem = async (shelfId: string) => {
    const form = itemForms[shelfId] || {
      item_type: 'reagent',
      item_id: '',
      lot_id: '',
      description: '',
      quantity: '',
      container_id: '',
      rack_id: '',
      search: '',
      rack_search: '',
      item_color: DEFAULT_REAGENT_COLOR
    }

    const searchValue = (form.search || '').trim()
    const searchLower = searchValue.toLowerCase()
    let selectedContainer: any | null = null
    const rackSearchSource = rackSearchResults[shelfId] || racks
    let selectedRack: any | null = null

    if (form.item_type === 'container') {
      if (form.container_id) {
        selectedContainer = containers.find((container) => container.id === form.container_id) || null
      }
      if (!selectedContainer && searchValue) {
        selectedContainer =
          containers.find((container) => (container.name || '').toLowerCase() === searchLower) ||
          containers.find((container) => (container.id || '').toLowerCase() === searchLower) ||
          null
      }

      if (!selectedContainer) {
        if (searchValue) {
          const confirmCreate = window.confirm(
            `Container "${searchValue}" does not exist.\n\nCreate it now?`
          )
          if (confirmCreate) {
            setCreateDrawerName(searchValue)
            setShowCreateDrawer(true)
          }
        }
        return
      }
    }
    if (form.item_type === 'rack') {
      if (form.rack_id) {
        selectedRack =
          rackSearchSource.find((rack) => rack.id === form.rack_id) ||
          racks.find((rack) => rack.id === form.rack_id) ||
          null
      }
      if (!selectedRack) return
    }
    if (form.item_type !== 'container' && form.item_type !== 'rack' && !form.item_id?.trim()) return

    setSavingItem((prev) => ({ ...prev, [shelfId]: true }))
    try {
      if (form.item_type === 'container') {
        const selected = selectedContainer
        if (!selected) {
          throw new Error('Container not found')
        }

        if (form.container_id !== selected.id) {
          setItemForms((prev) => ({
            ...prev,
            [shelfId]: { ...form, container_id: selected.id, search: selected.name || selected.id }
          }))
        }

        const existingItem = items.find(
          (item) => item.item_type === 'container' && item.container_id === selected.id
        )

        if (existingItem) {
          if (existingItem.shelf_id === shelfId) {
            setSavingItem((prev) => ({ ...prev, [shelfId]: false }))
            return
          }

          const confirmMove = window.confirm(
            'This container is already stored on another shelf.\n\nMove it to this shelf?'
          )
          if (!confirmMove) {
            setSavingItem((prev) => ({ ...prev, [shelfId]: false }))
            return
          }

          const { error: moveError } = await supabase
            .from('cold_storage_items')
            .update({ shelf_id: shelfId, cold_storage_id: unit.id, item_id: selected.name || selected.id })
            .eq('id', existingItem.id)

          if (moveError) throw moveError

          setItems((prev) =>
            prev.map((item) =>
              item.id === existingItem.id
                ? { ...item, shelf_id: shelfId, cold_storage_id: unit.id, item_id: selected.name || selected.id }
                : item
            )
          )

          setSavingItem((prev) => ({ ...prev, [shelfId]: false }))
          return
        }

        if (selected.rack_id || selected.rack_position) {
          const confirmRemove = window.confirm(
            'This container is currently assigned to a rack position.\n\n' +
              'Adding it to this shelf will remove its rack assignment. Continue?'
          )
          if (!confirmRemove) {
            setSavingItem((prev) => ({ ...prev, [shelfId]: false }))
            return
          }

          const { error: clearError } = await supabase
            .from('containers')
            .update({ rack_id: null, rack_position: null })
            .eq('id', selected.id)

          if (clearError) throw clearError
          setContainers((prev) =>
            prev.map((container) =>
              container.id === selected.id
                ? { ...container, rack_id: null, rack_position: null }
                : container
            )
          )
        }
      }

      if (form.item_type === 'rack') {
        const selected = selectedRack
        if (!selected) {
          throw new Error('Rack not found')
        }

        if (selected.cold_storage_id && selected.cold_storage_id !== unit.id) {
          const confirmMove = window.confirm(
            'This rack is assigned to a different cold storage unit.\n\nReassign it to this unit?'
          )
          if (!confirmMove) {
            setSavingItem((prev) => ({ ...prev, [shelfId]: false }))
            return
          }

          const { error: moveError } = await supabase
            .from('racks')
            .update({ cold_storage_id: unit.id })
            .eq('id', selected.id)

          if (moveError) throw moveError

          setRacks((prev) => {
            const exists = prev.find((rack) => rack.id === selected.id)
            if (exists) {
              return prev.map((rack) =>
                rack.id === selected.id ? { ...rack, cold_storage_id: unit.id } : rack
              )
            }
            return [...prev, { ...selected, cold_storage_id: unit.id }]
          })
          setRackSearchResults((prev) => ({
            ...prev,
            [shelfId]: (prev[shelfId] || []).map((rack) =>
              rack.id === selected.id ? { ...rack, cold_storage_id: unit.id } : rack
            )
          }))
        }
      }

      const quantity = form.quantity ? parseInt(form.quantity, 10) : null
      const itemId =
        form.item_type === 'container'
          ? selectedContainer?.name || selectedContainer?.id || form.container_id
          : form.item_type === 'rack'
            ? selectedRack?.name || form.rack_id
            : form.item_id.trim()
      const payload: any = {
        cold_storage_id: unit.id,
        shelf_id: shelfId,
        item_type: form.item_type,
        container_id: form.item_type === 'container' ? selectedContainer?.id || form.container_id : null,
        rack_id: form.item_type === 'rack' ? form.rack_id : null,
        item_id: itemId,
        lot_id: form.item_type === 'reagent' ? (form.lot_id || '').trim() || null : null,
        description: (form.description || '').trim() || null,
        quantity: form.item_type === 'rack' || form.item_type === 'container' ? null : Number.isNaN(quantity) ? null : quantity,
        item_color: form.item_type === 'reagent' || form.item_type === 'other' ? form.item_color || null : null
      }

      let insertResult = await supabase.from('cold_storage_items').insert([payload]).select()

      if (insertResult.error && /item_color/i.test(insertResult.error.message || '')) {
        delete payload.item_color
        insertResult = await supabase.from('cold_storage_items').insert([payload]).select()
      }

      if (insertResult.error) throw insertResult.error
      const { data } = insertResult
      setItems((prev) => [...(prev || []), ...(data || [])])
      setItemForms((prev) => ({
        ...prev,
        [shelfId]: {
          item_type: 'reagent',
          item_id: '',
          lot_id: '',
          description: '',
          quantity: '',
          container_id: '',
          rack_id: '',
          search: '',
          rack_search: '',
          item_color: DEFAULT_REAGENT_COLOR
        }
      }))
    } catch (e) {
      console.error('Failed to add item:', e)
      alert('Failed to add item')
    } finally {
      setSavingItem((prev) => ({ ...prev, [shelfId]: false }))
    }
  }

  const updateEditField = (key: string, value: string) => {
    setEditForm((prev: any) => ({ ...prev, [key]: value }))
  }

  const logAudit = async (payload: any) => {
    try {
      await supabase.from('audit_logs').insert([payload])
    } catch (e) {
      console.warn('Failed to write audit log', e)
    }
  }

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems((prev) => ({ ...prev, [itemId]: !prev[itemId] }))
  }

  const clearSelection = () => {
    setSelectedItems({})
  }

  const selectedItemIds = Object.keys(selectedItems).filter((id) => selectedItems[id])

  const handleBulkUpdate = async () => {
    if (selectedItemIds.length === 0) return
    const payload: any = {}
    if (bulkForm.item_id.trim()) payload.item_id = bulkForm.item_id.trim()
    if (bulkForm.lot_id.trim()) payload.lot_id = bulkForm.lot_id.trim()
    if (bulkForm.description.trim()) payload.description = bulkForm.description.trim()
    if (bulkForm.status.trim()) payload.status = bulkForm.status.trim()
    if (bulkForm.quantity.trim()) {
      const q = parseInt(bulkForm.quantity, 10)
      payload.quantity = Number.isNaN(q) ? null : q
    }

    if (Object.keys(payload).length === 0) {
      alert('Enter at least one field to update.')
      return
    }

    setSavingBulk(true)
    try {
      const { error } = await supabase
        .from('cold_storage_items')
        .update(payload)
        .in('id', selectedItemIds)

      if (error) throw error

      setItems((prev) =>
        prev.map((item) => (selectedItems[item.id] ? { ...item, ...payload } : item))
      )
      setShowBulkDrawer(false)
      setBulkForm({ item_id: '', lot_id: '', description: '', quantity: '', status: '' })
      clearSelection()
    } catch (e) {
      console.error('Failed to bulk update items:', e)
      alert('Failed to bulk update items')
    } finally {
      setSavingBulk(false)
    }
  }

  const openEditItem = (item: any) => {
    setEditingItem(item)
    setItemEditForm({
      item_id: item.item_id || '',
      lot_id: item.lot_id || '',
      description: item.description || '',
      quantity: item.quantity != null ? String(item.quantity) : '',
      status: item.status || ''
    })
    setOpenItemMenuId(null)
  }

  const handleSaveItemEdit = async () => {
    if (!editingItem) return
    const payload: any = {
      item_id: itemEditForm.item_id.trim(),
      lot_id: itemEditForm.lot_id.trim() || null,
      description: itemEditForm.description.trim() || null,
      status: itemEditForm.status.trim() || null
    }
    if (itemEditForm.quantity.trim()) {
      const q = parseInt(itemEditForm.quantity, 10)
      payload.quantity = Number.isNaN(q) ? null : q
    } else {
      payload.quantity = null
    }

    setSavingItemEdit(true)
    try {
      const { data, error } = await supabase
        .from('cold_storage_items')
        .update(payload)
        .eq('id', editingItem.id)
        .select()
        .single()

      if (error) throw error

      setItems((prev) => prev.map((item) => (item.id === editingItem.id ? data : item)))
      setEditingItem(null)
    } catch (e) {
      console.error('Failed to update item:', e)
      alert('Failed to update item')
    } finally {
      setSavingItemEdit(false)
    }
  }

  const handleDeleteItem = async (item: any) => {
    const confirmDelete = window.confirm('Delete this item from the shelf?')
    if (!confirmDelete) return
    try {
      const { error } = await supabase
        .from('cold_storage_items')
        .delete()
        .eq('id', item.id)

      if (error) throw error
      setItems((prev) => prev.filter((entry) => entry.id !== item.id))
      setOpenItemMenuId(null)
    } catch (e) {
      console.error('Failed to delete item:', e)
      alert('Failed to delete item')
    }
  }

  const persistShelfOrder = async (shelfId?: string | null, order?: string[]) => {
    if (!shelfId || !order || order.length === 0) return
    try {
      await Promise.all(
        order.map((id, index) =>
          supabase
            .from('cold_storage_items')
            .update({ sort_order: index })
            .eq('id', id)
        )
      )
    } catch (e) {
      console.warn('Failed to persist shelf order', e)
    }
  }

  const handleMoveItemToShelf = async (itemId: string, shelfId: string) => {
    const current = items.find((item) => item.id === itemId)
    if (!current || current.shelf_id === shelfId) return
    try {
      const { error } = await supabase
        .from('cold_storage_items')
        .update({ shelf_id: shelfId })
        .eq('id', itemId)

      if (error) throw error
      setItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, shelf_id: shelfId } : item)))

      const fromShelf = current.shelf_id
      const nextFromOrder = fromShelf ? (itemOrderByShelf[fromShelf] || []).filter((id) => id !== itemId) : []
      const nextToOrder = [...(itemOrderByShelf[shelfId] || []), itemId]

      setItemOrderByShelf((prev) => ({
        ...prev,
        ...(fromShelf ? { [fromShelf]: nextFromOrder } : {}),
        [shelfId]: nextToOrder
      }))

      await persistShelfOrder(fromShelf, nextFromOrder)
      await persistShelfOrder(shelfId, nextToOrder)
    } catch (e) {
      console.error('Failed to move item:', e)
      alert('Failed to move item')
    }
  }

  const handleReorderWithinShelf = (shelfId: string, itemId: string, targetId: string, position: 'before' | 'after') => {
    const currentOrder = [...(itemOrderByShelf[shelfId] || [])]
    const filtered = currentOrder.filter((id) => id !== itemId)
    const targetIndex = filtered.indexOf(targetId)
    if (targetIndex === -1) return
    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1
    filtered.splice(insertIndex, 0, itemId)
    setItemOrderByShelf((prev) => ({ ...prev, [shelfId]: filtered }))
    persistShelfOrder(shelfId, filtered)
  }

  const handleDropOnItem = async (shelfId: string, targetId: string, position: 'before' | 'after') => {
    if (!dragItemId) return
    const current = items.find((item) => item.id === dragItemId)
    if (!current) return

    if (current.shelf_id === shelfId) {
      handleReorderWithinShelf(shelfId, dragItemId, targetId, position)
    } else {
      await handleMoveItemToShelf(dragItemId, shelfId)
      handleReorderWithinShelf(shelfId, dragItemId, targetId, position)
    }
  }

  const loadStorageOptions = async () => {
    setLoadingMoveOptions(true)
    try {
      const { data } = await supabase
        .from('cold_storage_units')
        .select('*')
        .order('name', { ascending: true })
      setStorageOptions(data || [])
    } catch (e) {
      console.warn('Failed to load storage options', e)
      setStorageOptions([])
    } finally {
      setLoadingMoveOptions(false)
    }
  }

  useEffect(() => {
    if (showMoveDrawer) loadStorageOptions()
  }, [showMoveDrawer])

  if (loading) return <div className="muted">Loading cold storage...</div>
  if (!unit) return <div className="muted">Cold storage not found.</div>

  const handleMoveContents = async () => {
    if (!moveTargetId) return
    const confirmMove = window.confirm(
      'This will move all racks, shelves, items, and containers in this storage unit to the selected storage unit. Continue?'
    )
    if (!confirmMove) return

    setSavingUnit(true)
    try {
      const [{ error: shelfError }, { error: itemError }, { error: rackError }, { error: containerError }] = await Promise.all([
        supabase.from('cold_storage_shelves').update({ cold_storage_id: moveTargetId }).eq('cold_storage_id', unit.id),
        supabase.from('cold_storage_items').update({ cold_storage_id: moveTargetId }).eq('cold_storage_id', unit.id),
        supabase.from('racks').update({ cold_storage_id: moveTargetId }).eq('cold_storage_id', unit.id),
        supabase.from('containers').update({ cold_storage_id: moveTargetId }).eq('cold_storage_id', unit.id)
      ])

      if (shelfError || itemError || rackError || containerError) {
        throw shelfError || itemError || rackError || containerError
      }

      const user = getUser()
      const destination = storageOptions.find((option) => option.id === moveTargetId)
      await logAudit({
        user_initials: user?.initials || null,
        user_name: user?.name || null,
        entity_type: 'cold_storage',
        entity_id: unit.id,
        action: 'moved',
        entity_name: unit.name,
        changes: { from: unit.id, to: moveTargetId },
        metadata: {
          from_cold_storage_id: unit.id,
          from_cold_storage_name: unit.name,
          to_cold_storage_id: moveTargetId,
          to_cold_storage_name: destination?.name
        },
        description: `Moved contents from ${unit.name} to ${destination?.name || moveTargetId}`
      })

      alert('Contents moved successfully.')
      setShowMoveDrawer(false)
      window.location.hash = `#/cold-storage/${moveTargetId}`
    } catch (e) {
      console.error('Failed to move contents:', e)
      alert('Failed to move contents')
    } finally {
      setSavingUnit(false)
    }
  }

  const handleSaveUnit = async () => {
    if (!editForm) return
    if (!editForm.name?.trim()) {
      alert('Unit name is required')
      return
    }
    const confirmSave = window.confirm('Save changes to this storage unit?')
    if (!confirmSave) return
    setSavingUnit(true)
    try {
      const payload = {
        name: editForm.name.trim(),
        type: editForm.type?.trim() || null,
        temperature: editForm.temperature?.trim() || null,
        location: editForm.location?.trim() || null,
        pm_due_date: editForm.pm_due_date || null,
        model: editForm.model?.trim() || null,
        serial_number: editForm.serial_number?.trim() || null,
        status: editForm.status?.trim() || 'active',
        interior_image_url: editForm.interior_image_url?.trim() || null,
        interior_image_path: editForm.interior_image_path || null
      }

      const { data, error } = await supabase
        .from('cold_storage_units')
        .update(payload)
        .eq('id', unit.id)
        .select()
        .single()

      if (error) throw error
      setUnit(data)
      setEditForm(data)
      setShowEditDrawer(false)

      const user = getUser()
      await logAudit({
        user_initials: user?.initials || null,
        user_name: user?.name || null,
        entity_type: 'cold_storage',
        entity_id: unit.id,
        action: 'updated',
        entity_name: data.name,
        changes: { before: unit, after: data },
        metadata: { cold_storage_id: unit.id, cold_storage_name: data.name },
        description: `Cold storage ${data.name} updated`
      })
    } catch (e) {
      console.error('Failed to update cold storage unit:', e)
      alert('Failed to update storage unit')
    } finally {
      setSavingUnit(false)
    }
  }

  const handleDeleteUnit = async () => {
    if (!unit) return
    const confirmDelete = window.confirm(
      'Delete this storage unit?\n\nThis will remove shelves and items, unassign containers, and delete racks.'
    )
    if (!confirmDelete) return
    setSavingUnit(true)
    try {
      const { data: rackRows, error: rackError } = await supabase
        .from('racks')
        .select('id')
        .eq('cold_storage_id', unit.id)

      if (rackError) throw rackError
      const rackIds = (rackRows || []).map((rack: any) => rack.id)

      if (rackIds.length) {
        const { error: clearRackError } = await supabase
          .from('containers')
          .update({ rack_id: null, rack_position: null })
          .in('rack_id', rackIds)

        if (clearRackError) throw clearRackError
      }

      const { error: clearStorageError } = await supabase
        .from('containers')
        .update({ cold_storage_id: null })
        .eq('cold_storage_id', unit.id)

      if (clearStorageError) throw clearStorageError

      const { error: deleteItemsError } = await supabase
        .from('cold_storage_items')
        .delete()
        .eq('cold_storage_id', unit.id)

      if (deleteItemsError) throw deleteItemsError

      const { error: deleteShelvesError } = await supabase
        .from('cold_storage_shelves')
        .delete()
        .eq('cold_storage_id', unit.id)

      if (deleteShelvesError) throw deleteShelvesError

      if (rackIds.length) {
        const { error: deleteRacksError } = await supabase
          .from('racks')
          .delete()
          .in('id', rackIds)

        if (deleteRacksError) throw deleteRacksError
      }

      const { error: deleteUnitError } = await supabase
        .from('cold_storage_units')
        .delete()
        .eq('id', unit.id)

      if (deleteUnitError) throw deleteUnitError

      window.location.hash = '#/cold-storage'
    } catch (e) {
      console.error('Failed to delete storage unit:', e)
      alert('Failed to delete storage unit')
    } finally {
      setSavingUnit(false)
    }
  }

  const handleInteriorImageUpload = async (file: File) => {
    if (!unit) return
    setInteriorImageFileName(file.name)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = `cold-storage/${unit.id}/${Date.now()}-${safeName}`

    try {
      const { error: uploadError } = await supabase
        .storage
        .from(INTERIOR_IMAGE_BUCKET)
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      setEditForm((prev: any) => ({
        ...prev,
        interior_image_path: filePath,
        interior_image_url: ''
      }))

      const { data, error } = await supabase
        .storage
        .from(INTERIOR_IMAGE_BUCKET)
        .createSignedUrl(filePath, INTERIOR_IMAGE_TTL_SECONDS)

      if (error) throw error
      setInteriorImageUrl(data?.signedUrl || null)
    } catch (e) {
      console.error('Failed to upload interior image', e)
      alert('Failed to upload interior image')
      setInteriorImageFileName('')
    }
  }

  const handleRemoveInteriorImage = async () => {
    if (!unit) return
    const confirmRemove = window.confirm('Remove the interior image from this storage unit?')
    if (!confirmRemove) return
    setSavingUnit(true)
    try {
      const { error } = await supabase
        .from('cold_storage_units')
        .update({ interior_image_path: null, interior_image_url: null })
        .eq('id', unit.id)

      if (error) throw error
      setUnit((prev: any) => (prev ? { ...prev, interior_image_path: null, interior_image_url: null } : prev))
      setEditForm((prev: any) => (prev ? { ...prev, interior_image_path: null, interior_image_url: '' } : prev))
      setInteriorImageUrl(null)
      setInteriorImageFileName('')
    } catch (e) {
      console.error('Failed to remove interior image', e)
      alert('Failed to remove interior image')
    } finally {
      setSavingUnit(false)
    }
  }

  const handleRackInput = (key: 'name' | 'position' | 'grid_rows' | 'grid_cols', value: string) => {
    setRackForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleAddRack = async () => {
    if (!rackForm.name.trim()) return
    setSavingRack(true)
    try {
      const { data, error } = await supabase
        .from('racks')
        .insert([
          {
            cold_storage_id: unit.id,
            name: rackForm.name.trim(),
            position: rackForm.position.trim() || null,
            grid_rows: rackForm.grid_rows ? parseInt(rackForm.grid_rows, 10) : null,
            grid_cols: rackForm.grid_cols ? parseInt(rackForm.grid_cols, 10) : null
          }
        ])
        .select()

      if (error) throw error
      setRacks((prev) => [...(prev || []), ...(data || [])])
      setRackForm({ name: '', position: '', grid_rows: '', grid_cols: '' })

      const created = data?.[0]
      if (created) {
        const user = getUser()
        await logAudit({
          user_initials: user?.initials || null,
          user_name: user?.name || null,
          entity_type: 'rack',
          entity_id: created.id,
          action: 'created',
          entity_name: created.name,
          changes: { after: created },
          metadata: {
            rack_id: created.id,
            rack_name: created.name,
            cold_storage_id: unit.id,
            cold_storage_name: unit.name
          },
          description: `Rack ${created.name} created in ${unit.name}`
        })
      }
    } catch (e) {
      console.error('Failed to add rack:', e)
      alert('Failed to add rack')
    } finally {
      setSavingRack(false)
    }
  }

  return (
    <div>
      <LocationBreadcrumb items={breadcrumbItems} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>{unit.name}</h2>
          <div className="muted" style={{ marginTop: 4 }}>
            {unit.type} {unit.temperature ? `• ${unit.temperature}` : ''}
          </div>
          {unit.location && (
            <div className="muted" style={{ marginTop: 4 }}>{unit.location}</div>
          )}
          <div className="muted" style={{ marginTop: 4 }}>
            Next PM Due: {unit.pm_due_date ? formatDate(unit.pm_due_date) : '-'}
          </div>
          {(unit.model || unit.serial_number) && (
            <div className="muted" style={{ marginTop: 4 }}>
              {unit.model ? `Model: ${unit.model}` : ''}
              {unit.model && unit.serial_number ? ' • ' : ''}
              {unit.serial_number ? `Serial: ${unit.serial_number}` : ''}
            </div>
          )}
        </div>
        <button className="btn ghost" onClick={() => { window.location.hash = '#/cold-storage' }}>
          Back
        </button>
      </div>

      <div style={{display:'flex', justifyContent:'flex-end', marginBottom: 12}}>
        <div style={{ position: 'relative' }}>
          <button
            className="btn ghost"
            style={{ padding: '6px 10px' }}
            onClick={() => setShowContentsMenu((prev) => !prev)}
          >
            •••
          </button>
          {showContentsMenu && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: 36,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 8,
                padding: 6,
                zIndex: 20,
                display: 'grid',
                gap: 4,
                minWidth: 160
              }}
            >
              <button className="btn ghost" onClick={() => { setShowEditDrawer(true); setShowContentsMenu(false) }}>
                Edit Storage Unit
              </button>
              <button className="btn ghost" onClick={() => { setShowMoveDrawer(true); setShowContentsMenu(false) }}>
                Move Contents
              </button>
              <button
                className="btn ghost"
                onClick={() => { clearSelection(); setShowContentsMenu(false) }}
                disabled={selectedItemIds.length === 0}
              >
                Clear Selection
              </button>
              <button
                className="btn ghost"
                onClick={() => { setShowBulkDrawer(true); setShowContentsMenu(false) }}
                disabled={selectedItemIds.length === 0}
              >
                Bulk Edit Items
              </button>
            </div>
          )}
        </div>
      </div>

      {showEditDrawer && editForm && (
        <ColdStorageEditDrawer
          unit={editForm}
          onClose={() => setShowEditDrawer(false)}
          onSave={handleSaveUnit}
          onChange={updateEditField}
          saving={savingUnit}
          onUploadInteriorImage={handleInteriorImageUpload}
          onRemoveInteriorImage={handleRemoveInteriorImage}
          interiorImageFileName={interiorImageFileName}
          onDeleteUnit={handleDeleteUnit}
        />
      )}

      {showMoveDrawer && (
        <div className="drawer-overlay" onClick={() => setShowMoveDrawer(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Move Contents</h3>
              <button className="btn ghost" onClick={() => setShowMoveDrawer(false)}>Close</button>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              <label>
                Destination Storage Unit
                <select
                  value={moveTargetId}
                  onChange={(e) => setMoveTargetId(e.target.value)}
                  disabled={loadingMoveOptions}
                >
                  <option value="">Select storage unit</option>
                  {storageOptions
                    .filter((option) => option.id !== unit.id)
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name} {option.temperature ? `(${option.temperature})` : ''}
                      </option>
                    ))}
                </select>
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn ghost" onClick={() => setShowMoveDrawer(false)}>Cancel</button>
                <button className="btn" onClick={handleMoveContents} disabled={!moveTargetId || savingUnit}>
                  {savingUnit ? 'Moving...' : 'Move Contents'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateDrawer && unit && (
        <ContainerCreateDrawer
          onClose={() => {
            setShowCreateDrawer(false)
            setCreateDrawerName('')
          }}
          initialColdStorageId={unit.id}
          initialName={createDrawerName}
        />
      )}

      {showBulkDrawer && (
        <div className="drawer-overlay" onClick={() => setShowBulkDrawer(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Bulk Edit Items</h3>
              <button className="btn ghost" onClick={() => setShowBulkDrawer(false)}>Close</button>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              <div className="muted" style={{ fontSize: 13 }}>
                Updating {selectedItemIds.length} selected items
              </div>
              <label>
                Item ID (optional)
                <input
                  value={bulkForm.item_id}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, item_id: e.target.value }))}
                />
              </label>
              <label>
                Lot ID (optional)
                <input
                  value={bulkForm.lot_id}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, lot_id: e.target.value }))}
                />
              </label>
              <label>
                Description (optional)
                <input
                  value={bulkForm.description}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </label>
              <label>
                Quantity (optional)
                <input
                  value={bulkForm.quantity}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, quantity: e.target.value }))}
                />
              </label>
              <label>
                Status (optional)
                <input
                  value={bulkForm.status}
                  onChange={(e) => setBulkForm((prev) => ({ ...prev, status: e.target.value }))}
                />
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn ghost" onClick={() => setShowBulkDrawer(false)}>Cancel</button>
                <button className="btn" onClick={handleBulkUpdate} disabled={savingBulk}>
                  {savingBulk ? 'Saving...' : 'Apply Updates'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gap: 20 }}>
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Contents</h3>
            <div
              style={{
                display: 'inline-flex',
                border: '1px solid #e5e7eb',
                borderRadius: 999,
                overflow: 'hidden'
              }}
            >
              <button
                className="btn"
                style={{
                  padding: '6px 12px',
                  borderRadius: 0,
                  background: contentsView === 'shelves' ? '#3b82f6' : 'transparent',
                  color: contentsView === 'shelves' ? '#fff' : '#374151'
                }}
                onClick={() => setContentsView('shelves')}
              >
                Shelves
              </button>
              <button
                className="btn"
                style={{
                  padding: '6px 12px',
                  borderRadius: 0,
                  background: contentsView === 'list' ? '#3b82f6' : 'transparent',
                  color: contentsView === 'list' ? '#fff' : '#374151'
                }}
                onClick={() => setContentsView('list')}
              >
                All Items
              </button>
            </div>
          </div>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
            {selectedItemIds.length > 0 ? `${selectedItemIds.length} items selected` : 'Select items to bulk edit'}
          </div>

          {contentsView === 'shelves' ? (
            <>
              {shelves.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
                  {shelves.map((shelf) => (
                    <div
                      key={`${shelf.id}-overview`}
                      style={{ border: '1px dashed #e5e7eb', borderRadius: 10, padding: 10 }}
                    >
                      <div style={{ fontWeight: 600 }}>{shelf.name}</div>
                      <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                        {items.filter((item) => item.shelf_id === shelf.id).length} items
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8 }}>
                  <input
                    value={shelfForm.name}
                    onChange={(e) => handleShelfInput('name', e.target.value)}
                    placeholder="Shelf name (e.g., Shelf A)"
                  />
                  <input
                    value={shelfForm.position}
                    onChange={(e) => handleShelfInput('position', e.target.value)}
                    placeholder="Position or description (optional)"
                  />
                  <button className="btn" onClick={handleAddShelf} disabled={savingShelf || !shelfForm.name.trim()}>
                    {savingShelf ? 'Adding...' : 'Add Shelf'}
                  </button>
                </div>
              </div>

              {shelvesWithItems.length === 0 ? (
                <div className="muted">No shelves configured.</div>
              ) : (
                <div style={{ display: 'grid', gap: 16 }}>
                  {shelvesWithItems.map((shelf) => {
                    const form = itemForms[shelf.id] || {
                      item_type: 'reagent',
                      item_id: '',
                      lot_id: '',
                      description: '',
                      quantity: '',
                      container_id: '',
                      rack_id: '',
                      search: '',
                      rack_search: '',
                      item_color: DEFAULT_REAGENT_COLOR
                    }
                    const searchValue = (form.search || '').trim()
                    const searchLower = searchValue.toLowerCase()
                    const storedContainerIds = new Set(
                      items
                        .filter((item) => item.item_type === 'container' && item.container_id)
                        .map((item) => item.container_id)
                    )
                    const availableContainers = containers.filter(
                      (container) => !container.rack_id && !container.rack_position && !storedContainerIds.has(container.id)
                    )
                    const searchSource = containerSearchResults[shelf.id] || containers
                    const baseMatches = (searchValue ? searchSource : availableContainers).filter((container) => {
                      const label = `${container.name || ''} ${container.id || ''} ${formatContainerLocation(container) || ''}`
                        .toLowerCase()
                      return label.includes(searchLower)
                    })
                    const filteredContainers = [...baseMatches].sort((a, b) => {
                      const aAvailable = !a.rack_id && !a.rack_position && !storedContainerIds.has(a.id)
                      const bAvailable = !b.rack_id && !b.rack_position && !storedContainerIds.has(b.id)
                      if (aAvailable !== bAvailable) return aAvailable ? -1 : 1
                      return (a.name || a.id).localeCompare(b.name || b.id)
                    })
                    const hasExactMatch = !!searchValue && searchSource.some(
                      (container) =>
                        (container.name || '').toLowerCase() === searchLower ||
                        (container.id || '').toLowerCase() === searchLower
                    )
                    const isDropdownOpen = !!containerDropdownOpen[shelf.id]
                    const rackSearchValue = (form.rack_search || '').trim()
                    const rackSearchLower = rackSearchValue.toLowerCase()
                    const rackSearchSource = rackSearchResults[shelf.id] || racks
                    const filteredRacks = rackSearchSource.filter((rack) => {
                      const label = `${rack.name || ''} ${rack.position || ''}`.toLowerCase()
                      return label.includes(rackSearchLower)
                    })
                    const isRackDropdownOpen = !!rackDropdownOpen[shelf.id]
                    return (
                      <div key={shelf.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontWeight: 600 }}>{shelf.name}</div>
                            {shelf.position ? (
                              <div className="muted" style={{ fontSize: 12 }}>{shelf.position}</div>
                            ) : null}
                          </div>
                          <div style={{ position: 'relative' }}>
                            <button
                              className="btn ghost"
                              onClick={() => setActiveShelfMenuId((prev) => (prev === shelf.id ? null : shelf.id))}
                            >
                              •••
                            </button>
                            {activeShelfMenuId === shelf.id && (
                              <div
                                style={{
                                  position: 'absolute',
                                  right: 0,
                                  top: 36,
                                  background: '#fff',
                                  border: '1px solid #e5e7eb',
                                  borderRadius: 8,
                                  padding: 6,
                                  zIndex: 20,
                                  display: 'grid',
                                  gap: 4,
                                  minWidth: 140
                                }}
                              >
                                <button
                                  className="btn ghost"
                                  onClick={() => {
                                    setEditingShelfId(shelf.id)
                                    setActiveShelfMenuId(null)
                                  }}
                                >
                                  Edit shelf
                                </button>
                                <button
                                  className="btn ghost"
                                  onClick={() => {
                                    setEditingShelfId(shelf.id)
                                    setActiveShelfMenuId(null)
                                  }}
                                >
                                  Add items
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {editingShelfId === shelf.id && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                            <button className="btn ghost" onClick={() => setEditingShelfId(null)}>
                              Done editing
                            </button>
                          </div>
                        )}

                        {editingShelfId === shelf.id && (
                          <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
                          {form.item_type === 'container' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 2.4fr auto', gap: 8 }}>
                              <select
                                value={form.item_type}
                                onChange={(e) => handleItemInput(shelf.id, 'item_type', e.target.value)}
                              >
                                <option value="container">Container</option>
                                <option value="rack">Rack</option>
                                <option value="reagent">Reagent</option>
                                <option value="other">Other</option>
                              </select>
                              <div style={{ position: 'relative' }}>
                                <button
                                  className="btn ghost"
                                  type="button"
                                  onClick={() =>
                                    setContainerDropdownOpen((prev) => {
                                      const nextOpen = !prev[shelf.id]
                                      if (nextOpen) {
                                        queueContainerSearch(shelf.id, form.search || '')
                                      }
                                      return { ...prev, [shelf.id]: nextOpen }
                                    })
                                  }
                                  style={{
                                    width: '100%',
                                    justifyContent: 'space-between',
                                    border: '1px solid #e5e7eb',
                                    background: '#fff'
                                  }}
                                  aria-haspopup="listbox"
                                  aria-expanded={isDropdownOpen}
                                >
                                  <span>{form.search || 'Select container'}</span>
                                  <span style={{ fontSize: 12 }}>&#9662;</span>
                                </button>
                                {isDropdownOpen && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: 44,
                                      left: 0,
                                      right: 0,
                                      border: '1px solid #e5e7eb',
                                      borderRadius: 10,
                                      background: '#fff',
                                      boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
                                      zIndex: 30,
                                      overflow: 'hidden'
                                    }}
                                    role="listbox"
                                  >
                                    <input
                                      value={form.search}
                                      onChange={(e) => {
                                        handleItemInput(shelf.id, 'search', e.target.value)
                                        handleItemInput(shelf.id, 'container_id', '')
                                        queueContainerSearch(shelf.id, e.target.value)
                                      }}
                                      placeholder="Search..."
                                      autoFocus
                                      style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        border: 'none',
                                        borderBottom: '1px solid #e5e7eb',
                                        borderRadius: 0,
                                        padding: '10px 12px'
                                      }}
                                    />
                                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                                      {containerSearchLoading[shelf.id] && (
                                        <div className="muted" style={{ padding: 10, fontSize: 12 }}>
                                          Searching containers...
                                        </div>
                                      )}
                                      {filteredContainers.map((container) => (
                                        <button
                                          key={container.id}
                                          className={form.container_id === container.id ? 'btn' : 'btn ghost'}
                                          style={{
                                            justifyContent: 'space-between',
                                            width: '100%',
                                            borderRadius: 0,
                                            padding: '10px 12px'
                                          }}
                                          onClick={() => {
                                            handleItemInput(shelf.id, 'container_id', container.id)
                                            handleItemInput(shelf.id, 'search', container.name || container.id)
                                            setContainerDropdownOpen((prev) => ({ ...prev, [shelf.id]: false }))
                                          }}
                                        >
                                          <span style={{ display: 'grid', textAlign: 'left' }}>
                                            <span style={{ fontWeight: 600 }}>{container.name || container.id}</span>
                                            <span className="muted" style={{ fontSize: 12 }}>
                                              {formatContainerLocation(container) || 'No location'}
                                            </span>
                                          </span>
                                          {(() => {
                                            const isAvailable = !container.rack_id && !container.rack_position && !storedContainerIds.has(container.id)
                                            const isRacked = !!container.rack_id || !!container.rack_position
                                            const status = isAvailable ? 'Available' : isRacked ? 'In rack' : 'Stored'
                                            const statusColor = isAvailable ? '#16a34a' : isRacked ? '#2563eb' : '#d97706'
                                            return (
                                              <span
                                                style={{
                                                  fontSize: 11,
                                                  fontWeight: 600,
                                                  color: statusColor,
                                                  background: `${statusColor}22`,
                                                  padding: '2px 8px',
                                                  borderRadius: 999
                                                }}
                                              >
                                                {status}
                                              </span>
                                            )
                                          })()}
                                        </button>
                                      ))}
                                      {searchValue && !hasExactMatch && (
                                        <button
                                          className="btn ghost"
                                          style={{
                                            justifyContent: 'space-between',
                                            width: '100%',
                                            borderRadius: 0,
                                            padding: '10px 12px'
                                          }}
                                          onClick={() => {
                                            setCreateDrawerName(searchValue)
                                            setShowCreateDrawer(true)
                                            setContainerDropdownOpen((prev) => ({ ...prev, [shelf.id]: false }))
                                          }}
                                        >
                                          <span style={{ fontWeight: 600 }}>Create new: {searchValue}</span>
                                          <span className="muted" style={{ fontSize: 12 }}>New container</span>
                                        </button>
                                      )}
                                      {filteredContainers.length === 0 && !searchValue && (
                                        <div className="muted" style={{ padding: 10, fontSize: 12 }}>
                                          No containers found
                                        </div>
                                      )}
                                      {filteredContainers.length === 0 && searchValue && hasExactMatch && (
                                        <div className="muted" style={{ padding: 10, fontSize: 12 }}>
                                          No matching containers found
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <button
                                className="btn"
                                onClick={() => handleAddItem(shelf.id)}
                                disabled={savingItem[shelf.id] || (!form.container_id && !form.search.trim())}
                              >
                                {savingItem[shelf.id] ? 'Adding...' : 'Add Container'}
                              </button>
                            </div>
                          ) : form.item_type === 'rack' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 2.4fr auto', gap: 8 }}>
                              <select
                                value={form.item_type}
                                onChange={(e) => handleItemInput(shelf.id, 'item_type', e.target.value)}
                              >
                                <option value="container">Container</option>
                                <option value="rack">Rack</option>
                                <option value="reagent">Reagent</option>
                                <option value="other">Other</option>
                              </select>
                              <div style={{ position: 'relative' }}>
                                <button
                                  className="btn ghost"
                                  type="button"
                                  onClick={() =>
                                    setRackDropdownOpen((prev) => {
                                      const nextOpen = !prev[shelf.id]
                                      if (nextOpen) {
                                        queueRackSearch(shelf.id, form.rack_search || '')
                                      }
                                      return { ...prev, [shelf.id]: nextOpen }
                                    })
                                  }
                                  style={{
                                    width: '100%',
                                    justifyContent: 'space-between',
                                    border: '1px solid #e5e7eb',
                                    background: '#fff'
                                  }}
                                  aria-haspopup="listbox"
                                  aria-expanded={isRackDropdownOpen}
                                >
                                  <span>{form.rack_search || 'Select rack'}</span>
                                  <span style={{ fontSize: 12 }}>&#9662;</span>
                                </button>
                                {isRackDropdownOpen && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: 44,
                                      left: 0,
                                      right: 0,
                                      border: '1px solid #e5e7eb',
                                      borderRadius: 10,
                                      background: '#fff',
                                      boxShadow: '0 10px 24px rgba(15,23,42,0.12)',
                                      zIndex: 30,
                                      overflow: 'hidden'
                                    }}
                                    role="listbox"
                                  >
                                    <input
                                      value={form.rack_search}
                                      onChange={(e) => {
                                        handleItemInput(shelf.id, 'rack_search', e.target.value)
                                        handleItemInput(shelf.id, 'rack_id', '')
                                        queueRackSearch(shelf.id, e.target.value)
                                      }}
                                      placeholder="Search racks..."
                                      autoFocus
                                      style={{
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        border: 'none',
                                        borderBottom: '1px solid #e5e7eb',
                                        borderRadius: 0,
                                        padding: '10px 12px'
                                      }}
                                    />
                                    <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                                      {rackSearchLoading[shelf.id] && (
                                        <div className="muted" style={{ padding: 10, fontSize: 12 }}>
                                          Searching racks...
                                        </div>
                                      )}
                                      {filteredRacks.map((rack) => (
                                        <button
                                          key={rack.id}
                                          className={form.rack_id === rack.id ? 'btn' : 'btn ghost'}
                                          style={{
                                            justifyContent: 'space-between',
                                            width: '100%',
                                            borderRadius: 0,
                                            padding: '10px 12px'
                                          }}
                                          onClick={() => {
                                            handleItemInput(shelf.id, 'rack_id', rack.id)
                                            handleItemInput(
                                              shelf.id,
                                              'rack_search',
                                              `${rack.name}${rack.position ? ` • ${rack.position}` : ''}`
                                            )
                                            setRackDropdownOpen((prev) => ({ ...prev, [shelf.id]: false }))
                                          }}
                                        >
                                          <span style={{ display: 'grid', textAlign: 'left' }}>
                                            <span style={{ fontWeight: 600 }}>{rack.name || rack.id}</span>
                                            <span className="muted" style={{ fontSize: 12 }}>
                                              {rack.position || 'No position'}
                                            </span>
                                          </span>
                                        </button>
                                      ))}
                                      {filteredRacks.length === 0 && (
                                        <div className="muted" style={{ padding: 10, fontSize: 12 }}>
                                          No matching racks found
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <button
                                className="btn"
                                onClick={() => handleAddItem(shelf.id)}
                                disabled={savingItem[shelf.id] || !form.rack_id}
                              >
                                {savingItem[shelf.id] ? 'Adding...' : 'Add Rack'}
                              </button>
                            </div>
                          ) : form.item_type === 'reagent' ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr 1fr 1.4fr 0.7fr 0.8fr auto', gap: 8 }}>
                              <select
                                value={form.item_type}
                                onChange={(e) => handleItemInput(shelf.id, 'item_type', e.target.value)}
                              >
                                <option value="container">Container</option>
                                <option value="rack">Rack</option>
                                <option value="reagent">Reagent</option>
                                <option value="other">Other</option>
                              </select>
                              <input
                                value={form.item_id}
                                onChange={(e) => handleItemInput(shelf.id, 'item_id', e.target.value)}
                                placeholder="Item"
                              />
                              <input
                                value={form.lot_id}
                                onChange={(e) => handleItemInput(shelf.id, 'lot_id', e.target.value)}
                                placeholder="Lot ID (optional)"
                              />
                              <input
                                value={form.description}
                                onChange={(e) => handleItemInput(shelf.id, 'description', e.target.value)}
                                placeholder="Description"
                              />
                              <input
                                value={form.quantity}
                                onChange={(e) => handleItemInput(shelf.id, 'quantity', e.target.value)}
                                placeholder="Qty"
                              />
                              <input
                                type="color"
                                value={form.item_color}
                                onChange={(e) => handleItemInput(shelf.id, 'item_color', e.target.value)}
                                title="Badge color"
                              />
                              <button
                                className="btn"
                                onClick={() => handleAddItem(shelf.id)}
                                disabled={savingItem[shelf.id] || !(form.item_id || '').trim()}
                              >
                                {savingItem[shelf.id] ? 'Adding...' : 'Add Item'}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr 1.4fr 0.7fr 0.8fr auto', gap: 8 }}>
                              <select
                                value={form.item_type}
                                onChange={(e) => handleItemInput(shelf.id, 'item_type', e.target.value)}
                              >
                                <option value="container">Container</option>
                                <option value="rack">Rack</option>
                                <option value="reagent">Reagent</option>
                                <option value="other">Other</option>
                              </select>
                              <input
                                value={form.item_id}
                                onChange={(e) => handleItemInput(shelf.id, 'item_id', e.target.value)}
                                placeholder="Item name"
                              />
                              <input
                                value={form.description}
                                onChange={(e) => handleItemInput(shelf.id, 'description', e.target.value)}
                                placeholder="Description"
                              />
                              <input
                                value={form.quantity}
                                onChange={(e) => handleItemInput(shelf.id, 'quantity', e.target.value)}
                                placeholder="Qty"
                              />
                              <input
                                type="color"
                                value={form.item_color}
                                onChange={(e) => handleItemInput(shelf.id, 'item_color', e.target.value)}
                                title="Badge color"
                              />
                              <button
                                className="btn"
                                onClick={() => handleAddItem(shelf.id)}
                                disabled={savingItem[shelf.id] || !(form.item_id || '').trim()}
                              >
                                {savingItem[shelf.id] ? 'Adding...' : 'Add Item'}
                              </button>
                            </div>
                          )}
                          </div>
                        )}

                        <div
                          onDragOver={(e) => {
                            e.preventDefault()
                            setDragOverShelfId(shelf.id)
                          }}
                          onDragLeave={() => setDragOverShelfId((prev) => (prev === shelf.id ? null : prev))}
                          onDrop={(e) => {
                            e.preventDefault()
                            if (dragItemId && !dragOverItem) {
                              handleMoveItemToShelf(dragItemId, shelf.id)
                            }
                            setDragItemId(null)
                            setDragOverItem(null)
                            setDragOverShelfId(null)
                          }}
                          style={{
                            minHeight: 64,
                            border: dragOverShelfId === shelf.id ? '1px dashed #3b82f6' : '1px dashed #e5e7eb',
                            borderRadius: 8,
                            padding: 8
                          }}
                        >
                          {shelf.items.length === 0 ? (
                            <div className="muted" style={{ fontSize: 13 }}>No items stored on this shelf.</div>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                              {(itemOrderByShelf[shelf.id] || shelf.items.map((item: any) => item.id))
                                .map((id) => shelf.items.find((item: any) => item.id === id))
                                .filter(Boolean)
                                .map((item: any) => {
                                  const badgeColors = getBadgeColors(item)
                                  return (
                                    <div
                                      key={item.id}
                                      draggable
                                      onDragStart={() => setDragItemId(item.id)}
                                      onDragEnd={() => setDragItemId(null)}
                                      onDragOver={(e) => {
                                        e.preventDefault()
                                        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                                        const position = e.clientX - rect.left < rect.width / 2 ? 'before' : 'after'
                                        setDragOverItem({ shelfId: shelf.id, itemId: item.id, position })
                                      }}
                                      onDragLeave={() => setDragOverItem((prev) => (prev?.itemId === item.id ? null : prev))}
                                      onDrop={(e) => {
                                        e.preventDefault()
                                        const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
                                        const position = e.clientX - rect.left < rect.width / 2 ? 'before' : 'after'
                                        handleDropOnItem(shelf.id, item.id, position)
                                        setDragItemId(null)
                                        setDragOverItem(null)
                                        setDragOverShelfId(null)
                                      }}
                                      style={{
                                        position: 'relative',
                                        padding: '14px 16px',
                                        borderRadius: 12,
                                        background: badgeColors.bg,
                                        border: `1px solid ${badgeColors.border}`,
                                        color: badgeColors.text,
                                        fontSize: 12,
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minWidth: 132,
                                        minHeight: 58,
                                        boxShadow:
                                          dragOverItem?.itemId === item.id
                                            ? dragOverItem.position === 'before'
                                              ? 'inset 3px 0 0 #3b82f6'
                                              : 'inset -3px 0 0 #3b82f6'
                                            : '0 6px 18px rgba(15,23,42,0.08)'
                                      }}
                                    >
                                      <div style={{ textAlign: 'center', fontWeight: 600, lineHeight: 1.2 }}>
                                        <div>{item.item_id}</div>
                                        {item.item_type === 'container' && item.container_id && (
                                          <div style={{ fontSize: 11, color: badgeColors.text, marginTop: 4 }}>
                                            {containerById[item.container_id]?.used ?? 0}/{containerById[item.container_id]?.total ?? '-'}
                                          </div>
                                        )}
                                        {item.item_type === 'reagent' && item.lot_id && (
                                          <div style={{ fontSize: 11, color: badgeColors.text, marginTop: 4 }}>
                                            Lot: {item.lot_id}
                                          </div>
                                        )}
                                      </div>
                                      {editingShelfId === shelf.id && (
                                        <button
                                          className="btn ghost"
                                          style={{
                                            padding: 0,
                                            height: 18,
                                            width: 18,
                                            minWidth: 18,
                                            borderRadius: 999,
                                            position: 'absolute',
                                            top: 2,
                                            right: 6,
                                            color: '#ef4444',
                                            lineHeight: '18px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 12,
                                            border: 'none',
                                            boxShadow: 'none',
                                            outline: 'none',
                                            background: 'transparent'
                                          }}
                                          onClick={() => handleDeleteItem(item)}
                                          aria-label="Delete item"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  )
                                })}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ textAlign: 'left', background: '#f9fafb' }}>
                    <th style={{ padding: 8 }}>
                      <input
                        type="checkbox"
                        checked={items.length > 0 && items.every((item: any) => selectedItems[item.id])}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setSelectedItems((prev) => {
                            const next = { ...prev }
                            items.forEach((item: any) => {
                              next[item.id] = checked
                            })
                            return next
                          })
                        }}
                      />
                    </th>
                    <th style={{ padding: 8 }}>Shelf</th>
                    <th style={{ padding: 8 }}>Type</th>
                    <th style={{ padding: 8 }}>Item ID</th>
                    <th style={{ padding: 8 }}>Lot ID</th>
                    <th style={{ padding: 8 }}>Description</th>
                    <th style={{ padding: 8 }}>Quantity</th>
                    <th style={{ padding: 8 }}>Status</th>
                    <th style={{ padding: 8, textAlign: 'right' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item: any) => (
                    <tr key={item.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: 8 }}>
                        <input
                          type="checkbox"
                          checked={!!selectedItems[item.id]}
                          onChange={() => toggleItemSelection(item.id)}
                        />
                      </td>
                      <td style={{ padding: 8 }}>{shelfNameById[item.shelf_id] || '-'}</td>
                      <td style={{ padding: 8 }}>{item.item_type || 'reagent'}</td>
                      <td style={{ padding: 8 }}>
                        {item.item_type === 'container' && item.container_id ? (
                          <button
                            className="btn ghost"
                            style={{ padding: 0, height: 'auto' }}
                            onClick={() => { window.location.hash = `#/containers/${item.container_id}` }}
                          >
                            {item.item_id}
                          </button>
                        ) : item.item_type === 'rack' && item.rack_id ? (
                          <button
                            className="btn ghost"
                            style={{ padding: 0, height: 'auto' }}
                            onClick={() => { window.location.hash = `#/racks/${item.rack_id}` }}
                          >
                            {item.item_id}
                          </button>
                        ) : (
                          item.item_id
                        )}
                      </td>
                      <td style={{ padding: 8 }}>{item.lot_id || '-'}</td>
                      <td style={{ padding: 8 }}>{item.description || '-'}</td>
                      <td style={{ padding: 8 }}>{item.quantity ?? '-'}</td>
                      <td style={{ padding: 8 }}>{item.status || '-'}</td>
                      <td style={{ padding: 8, textAlign: 'right', position: 'relative' }}>
                        <button
                          className="btn ghost"
                          onClick={() => setOpenItemMenuId((prev) => (prev === item.id ? null : item.id))}
                        >
                          •••
                        </button>
                        {openItemMenuId === item.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 36,
                              background: '#fff',
                              border: '1px solid #e5e7eb',
                              borderRadius: 8,
                              padding: 6,
                              zIndex: 20,
                              display: 'grid',
                              gap: 4,
                              minWidth: 140
                            }}
                          >
                            <button className="btn ghost" onClick={() => openEditItem(item)}>
                              Edit item
                            </button>
                            <button className="btn ghost" onClick={() => handleDeleteItem(item)}>
                              Delete item
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {editingItem && (
          <div className="drawer-overlay" onClick={() => setEditingItem(null)}>
            <div className="drawer" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Edit Item</h3>
                <button className="btn ghost" onClick={() => setEditingItem(null)}>Close</button>
              </div>
              <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                <label>
                  Item ID
                  <input
                    value={itemEditForm.item_id}
                    onChange={(e) => setItemEditForm((prev) => ({ ...prev, item_id: e.target.value }))}
                  />
                </label>
                <label>
                  Lot ID (optional)
                  <input
                    value={itemEditForm.lot_id}
                    onChange={(e) => setItemEditForm((prev) => ({ ...prev, lot_id: e.target.value }))}
                  />
                </label>
                <label>
                  Description (optional)
                  <input
                    value={itemEditForm.description}
                    onChange={(e) => setItemEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  />
                </label>
                <label>
                  Quantity (optional)
                  <input
                    value={itemEditForm.quantity}
                    onChange={(e) => setItemEditForm((prev) => ({ ...prev, quantity: e.target.value }))}
                  />
                </label>
                <label>
                  Status (optional)
                  <input
                    value={itemEditForm.status}
                    onChange={(e) => setItemEditForm((prev) => ({ ...prev, status: e.target.value }))}
                  />
                </label>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button className="btn ghost" onClick={() => setEditingItem(null)}>Cancel</button>
                  <button className="btn" onClick={handleSaveItemEdit} disabled={savingItemEdit}>
                    {savingItemEdit ? 'Saving...' : 'Save Item'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <section>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Interior</h3>
          {interiorImageUrl || unit.interior_image_url ? (
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 8 }}>
              <img
                src={interiorImageUrl || unit.interior_image_url}
                alt={`${unit.name} interior`}
                style={{ width: '100%', maxHeight: 280, objectFit: 'cover', borderRadius: 8 }}
              />
            </div>
          ) : (
            <div className="muted">No interior image attached.</div>
          )}
        </section>
      </div>
    </div>
  )
}

function ColdStorageEditDrawer({
  unit,
  onClose,
  onSave,
  onChange,
  saving,
  onUploadInteriorImage,
  onRemoveInteriorImage,
  interiorImageFileName,
  onDeleteUnit
}: {
  unit: any
  onClose: () => void
  onSave: () => void
  onChange: (key: string, value: string) => void
  saving: boolean
  onUploadInteriorImage: (file: File) => void
  onRemoveInteriorImage: () => void
  interiorImageFileName: string
  onDeleteUnit: () => void
}){
  if (!unit) return null

  const fileInputId = `interior-upload-${unit.id || 'unit'}`

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{margin:0}}>Edit Storage Unit</h3>
          <button className="btn ghost" onClick={onClose}>Close</button>
        </div>

        <div style={{marginTop:12,display:'grid',gap:10}}>
          <label>
            INV Number
            <input value={unit.name || ''} onChange={(e) => onChange('name', e.target.value)} />
          </label>
          <label>
            Type
            <select value={unit.type || ''} onChange={(e) => onChange('type', e.target.value)}>
              <option value="">Select type</option>
              {['Freezer', 'Refrigerator'].map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label>
            Temperature
            <select value={unit.temperature || ''} onChange={(e) => onChange('temperature', e.target.value)}>
              <option value="">Select temperature</option>
              {TEMPS.map((temp) => (
                <option key={temp} value={temp}>{temp}</option>
              ))}
            </select>
          </label>
          <label>
            Location
            <input value={unit.location || ''} onChange={(e) => onChange('location', e.target.value)} />
          </label>
          <label>
            Interior Image
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  const input = document.getElementById(fileInputId) as HTMLInputElement | null
                  input?.click()
                }}
              >
                Upload Image
              </button>
              <input
                id={fileInputId}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onUploadInteriorImage(file)
                }}
              />
              <span className="muted" style={{ fontSize: 12 }}>
                {unit.interior_image_path ? 'Image uploaded' : 'No image uploaded'}
              </span>
              {unit.interior_image_path && (
                <button
                  className="btn ghost"
                  type="button"
                  onClick={onRemoveInteriorImage}
                >
                  Remove
                </button>
              )}
            </div>
            {interiorImageFileName ? (
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Selected: {interiorImageFileName}
              </div>
            ) : null}
          </label>
          <label>
            Next PM Due Date
            <input type="date" value={unit.pm_due_date || ''} onChange={(e) => onChange('pm_due_date', e.target.value)} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label>
              Model
              <input value={unit.model || ''} onChange={(e) => onChange('model', e.target.value)} />
            </label>
            <label>
              Serial Number
              <input value={unit.serial_number || ''} onChange={(e) => onChange('serial_number', e.target.value)} />
            </label>
          </div>
          <label>
            Status
            <select
              value={unit.status || 'active'}
              onChange={(e) => onChange('status', e.target.value)}
            >
              <option value="active">In Service</option>
              <option value="out_of_service">Out of Service</option>
            </select>
          </label>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:8}}>
            <button className="btn ghost" onClick={onDeleteUnit} disabled={saving}>
              Delete Unit
            </button>
            <button className="btn ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button className="btn" onClick={onSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Unit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
