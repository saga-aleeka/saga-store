import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/api'
import { getUser } from '../lib/auth'
import { CONTAINER_LOCATION_SELECT, formatContainerLocation } from '../lib/locationUtils'
import LocationBreadcrumb from './LocationBreadcrumb'
import ContainerCreateDrawer from './ContainerCreateDrawer'

export default function RackDetails({ id }: { id: string }) {
  const [rack, setRack] = useState<any | null>(null)
  const [containers, setContainers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editForm, setEditForm] = useState<any | null>(null)
  const [showEditDrawer, setShowEditDrawer] = useState(false)
  const [savingRack, setSavingRack] = useState(false)
  const [showAssignDrawer, setShowAssignDrawer] = useState(false)
  const [assignPosition, setAssignPosition] = useState<string>('')
  const [assignContainerId, setAssignContainerId] = useState<string>('')
  const [assignSearch, setAssignSearch] = useState('')
  const [availableContainers, setAvailableContainers] = useState<any[]>([])
  const [loadingAvailable, setLoadingAvailable] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [showCreateDrawer, setShowCreateDrawer] = useState(false)
  const [storageOptions, setStorageOptions] = useState<any[]>([])
  const [loadingStorageOptions, setLoadingStorageOptions] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const [{ data: rackData }, { data: containerData }] = await Promise.all([
          supabase
            .from('racks')
            .select('*, cold_storage_units(*)')
            .eq('id', id)
            .single(),
          supabase
            .from('containers')
            .select(CONTAINER_LOCATION_SELECT)
            .eq('rack_id', id)
            .eq('archived', false)
            .order('updated_at', { ascending: false })
        ])

        if (!mounted) return
        setRack(rackData || null)
        setEditForm(
          rackData
            ? {
                ...rackData,
                cold_storage_id: rackData.cold_storage_id || rackData.cold_storage_units?.id || '',
                grid_rows: rackData.grid_rows ? String(rackData.grid_rows) : '',
                grid_cols: rackData.grid_cols ? String(rackData.grid_cols) : ''
              }
            : null
        )
        setContainers(containerData || [])
      } catch (e) {
        console.error('Failed to load rack details:', e)
        if (mounted) {
          setRack(null)
          setContainers([])
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

  const coldStorage = rack?.cold_storage_units

  const indexToLetters = (index: number) => {
    let result = ''
    let i = index
    while (i >= 0) {
      result = String.fromCharCode(65 + (i % 26)) + result
      i = Math.floor(i / 26) - 1
    }
    return result
  }

  const buildRackPositions = (rows: number, cols: number) => {
    const positions: string[] = []
    for (let r = 1; r <= rows; r++) {
      for (let c = 0; c < cols; c++) {
        const colLabel = indexToLetters(c)
        positions.push(`${colLabel}${r}`)
      }
    }
    return positions
  }

  const logAudit = async (payload: any) => {
    try {
      await supabase.from('audit_logs').insert([payload])
    } catch (e) {
      console.warn('Failed to write audit log', e)
    }
  }

  const loadStorageOptions = async () => {
    setLoadingStorageOptions(true)
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
      setLoadingStorageOptions(false)
    }
  }

  useEffect(() => {
    if (showEditDrawer) {
      setEditForm((prev: any) =>
        prev && !prev.cold_storage_id
          ? { ...prev, cold_storage_id: rack?.cold_storage_id || rack?.cold_storage_units?.id || '' }
          : prev
      )
      loadStorageOptions()
    }
  }, [showEditDrawer])

  const handleEditField = (key: string, value: string) => {
    setEditForm((prev: any) => ({ ...prev, [key]: value }))
  }

  const handleSaveRack = async () => {
    if (!editForm) return
    if (!editForm.name?.trim()) {
      alert('Rack name is required')
      return
    }

    const confirmSave = window.confirm('Save changes to this rack?')
    if (!confirmSave) return

    const nextRows = editForm.grid_rows ? parseInt(editForm.grid_rows, 10) : null
    const nextCols = editForm.grid_cols ? parseInt(editForm.grid_cols, 10) : null
    const nextColdStorageId = editForm.cold_storage_id || rack.cold_storage_id
    const gridChanged = nextRows !== rack.grid_rows || nextCols !== rack.grid_cols
    const hasAssigned = containers.some((container) => container.rack_position)
    const coldStorageChanged = nextColdStorageId !== rack.cold_storage_id

    if (coldStorageChanged) {
      const confirmMove = window.confirm('Move this rack to a new storage unit and update all containers in the rack?')
      if (!confirmMove) return
    }

    if (gridChanged && hasAssigned) {
      const confirmClear = window.confirm('Changing the rack size will clear all assigned rack positions for containers on this rack. Continue?')
      if (!confirmClear) return
    }

    setSavingRack(true)
    try {
      const { data, error } = await supabase
        .from('racks')
        .update({
          name: editForm.name.trim(),
          position: editForm.position?.trim() || null,
          grid_rows: nextRows,
          grid_cols: nextCols,
          cold_storage_id: nextColdStorageId
        })
        .eq('id', rack.id)
        .select()
        .single()

      if (error) throw error
      setRack(data)
      setEditForm({
        ...data,
        grid_rows: data.grid_rows ? String(data.grid_rows) : '',
        grid_cols: data.grid_cols ? String(data.grid_cols) : ''
      })

      if (coldStorageChanged) {
        const { error: moveError } = await supabase
          .from('containers')
          .update({ cold_storage_id: nextColdStorageId })
          .eq('rack_id', rack.id)

        if (moveError) throw moveError
        setContainers((prev) => prev.map((container) => ({ ...container, cold_storage_id: nextColdStorageId })))
      }

      const user = getUser()
      const fromStorage = storageOptions.find((option) => option.id === rack.cold_storage_id)
      const toStorage = storageOptions.find((option) => option.id === nextColdStorageId)
      await logAudit({
        user_initials: user?.initials || null,
        user_name: user?.name || null,
        entity_type: 'rack',
        entity_id: data.id,
        action: 'updated',
        entity_name: data.name,
        changes: { before: rack, after: data },
        metadata: {
          rack_id: data.id,
          rack_name: data.name,
          cold_storage_id: data.cold_storage_id,
          cold_storage_name: coldStorage?.name,
          from_cold_storage_id: rack.cold_storage_id,
          from_cold_storage_name: fromStorage?.name,
          to_cold_storage_id: nextColdStorageId,
          to_cold_storage_name: toStorage?.name
        },
        description: `Rack ${data.name} updated`
      })

      if (gridChanged && hasAssigned) {
        const { error: clearError } = await supabase
          .from('containers')
          .update({ rack_position: null })
          .eq('rack_id', rack.id)
          .not('rack_position', 'is', null)

        if (clearError) throw clearError
        setContainers((prev) => prev.map((container) => ({ ...container, rack_position: null })))
        alert('All rack positions cleared. Please reassign containers on the new grid.')
      }

      setShowEditDrawer(false)
    } catch (e) {
      console.error('Failed to update rack:', e)
      alert('Failed to update rack')
    } finally {
      setSavingRack(false)
    }
  }

  const handleDeleteRack = async () => {
    if (!rack) return
    const confirmDelete = window.confirm(
      'Delete this rack?\n\nThis will unassign containers from the rack and remove the rack.'
    )
    if (!confirmDelete) return
    setSavingRack(true)
    try {
      if (containers.length) {
        const { error: clearError } = await supabase
          .from('containers')
          .update({ rack_id: null, rack_position: null })
          .eq('rack_id', rack.id)

        if (clearError) throw clearError
      }

      const { error } = await supabase
        .from('racks')
        .delete()
        .eq('id', rack.id)

      if (error) throw error
      window.location.hash = rack.cold_storage_id ? `#/cold-storage/${rack.cold_storage_id}` : '#/cold-storage'
    } catch (e) {
      console.error('Failed to delete rack:', e)
      alert('Failed to delete rack')
    } finally {
      setSavingRack(false)
    }
  }

  const openAssign = (position: string) => {
    setAssignPosition(position)
    setAssignContainerId('')
    setAssignSearch('')
    setShowAssignDrawer(true)
  }

  const loadAvailableContainers = async () => {
    setLoadingAvailable(true)
    try {
      const { data } = await supabase
        .from('containers')
        .select(CONTAINER_LOCATION_SELECT)
        .eq('archived', false)
        .order('updated_at', { ascending: false })
      setAvailableContainers(data || [])
    } catch (e) {
      console.warn('Failed to load available containers', e)
      setAvailableContainers([])
    } finally {
      setLoadingAvailable(false)
    }
  }

  useEffect(() => {
    if (showAssignDrawer) {
      loadAvailableContainers()
    }
  }, [showAssignDrawer])

  const handleAssignContainer = async () => {
    if (!assignContainerId) return
    setAssigning(true)
    try {
      const { data, error } = await supabase
        .from('containers')
        .update({
          rack_id: rack.id,
          rack_position: assignPosition,
          cold_storage_id: rack.cold_storage_id
        })
        .eq('id', assignContainerId)
        .select(CONTAINER_LOCATION_SELECT)
        .single()

      if (error) throw error
      setContainers((prev) => {
        const existing = prev.find((container) => container.id === data.id)
        if (existing) {
          return prev.map((container) => (container.id === data.id ? data : container))
        }
        return [data, ...prev]
      })
      setShowAssignDrawer(false)
    } catch (e) {
      console.error('Failed to assign container:', e)
      alert('Failed to assign container')
    } finally {
      setAssigning(false)
    }
  }

  if (loading) return <div className="muted">Loading rack...</div>
  if (!rack) return <div className="muted">Rack not found.</div>

  const breadcrumbItems = [
    ...(coldStorage ? [{ label: coldStorage.name, href: `#/cold-storage/${coldStorage.id}` }] : []),
    { label: rack.name }
  ]

  const gridRows = rack.grid_rows || 0
  const gridCols = rack.grid_cols || 0
  const gridPositions = gridRows && gridCols ? buildRackPositions(gridRows, gridCols) : []
  const positionMap = containers.reduce<Record<string, any>>((acc, container) => {
    if (container.rack_position) acc[container.rack_position] = container
    return acc
  }, {})

  return (
    <div>
      <LocationBreadcrumb items={breadcrumbItems} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0 }}>{rack.name}</h2>
          {rack.position && <div className="muted" style={{ marginTop: 4 }}>{rack.position}</div>}
          {rack.grid_rows && rack.grid_cols && (
            <div className="muted" style={{ marginTop: 4 }}>Grid: {rack.grid_rows}x{rack.grid_cols}</div>
          )}
          {coldStorage && (
            <div className="muted" style={{ marginTop: 4 }}>
              {coldStorage.name} {coldStorage.temperature ? `• ${coldStorage.temperature}` : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" onClick={() => setShowEditDrawer(true)}>Edit Rack</button>
          <button className="btn ghost" onClick={() => { window.location.hash = coldStorage ? `#/cold-storage/${coldStorage.id}` : '#/cold-storage' }}>
            Back
          </button>
        </div>
      </div>

      {showEditDrawer && editForm && (
        <div className="drawer-overlay" onClick={() => setShowEditDrawer(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Edit Rack</h3>
              <button className="btn ghost" onClick={() => setShowEditDrawer(false)}>Close</button>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              <label>
                Rack Name
                <input value={editForm.name || ''} onChange={(e) => handleEditField('name', e.target.value)} />
              </label>
              <label>
                Position
                <input value={editForm.position || ''} onChange={(e) => handleEditField('position', e.target.value)} />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <label>
                  Rows
                  <input
                    type="number"
                    min={1}
                    value={editForm.grid_rows || ''}
                    onChange={(e) => handleEditField('grid_rows', e.target.value)}
                  />
                </label>
                <label>
                  Columns
                  <input
                    type="number"
                    min={1}
                    value={editForm.grid_cols || ''}
                    onChange={(e) => handleEditField('grid_cols', e.target.value)}
                  />
                </label>
              </div>
              <label>
                Cold Storage
                <select
                  value={editForm.cold_storage_id || ''}
                  onChange={(e) => handleEditField('cold_storage_id', e.target.value)}
                  disabled={loadingStorageOptions}
                >
                  <option value="">Select storage</option>
                  {storageOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name} {option.temperature ? `(${option.temperature})` : ''}
                    </option>
                  ))}
                </select>
              </label>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                <button className="btn ghost" onClick={handleDeleteRack} disabled={savingRack}>
                  Delete Rack
                </button>
                <button className="btn ghost" onClick={() => setShowEditDrawer(false)} disabled={savingRack}>Cancel</button>
                <button className="btn" onClick={handleSaveRack} disabled={savingRack}>
                  {savingRack ? 'Saving...' : 'Save Rack'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAssignDrawer && (
        <div className="drawer-overlay" onClick={() => setShowAssignDrawer(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>Assign Container: {assignPosition}</h3>
              <button className="btn ghost" onClick={() => setShowAssignDrawer(false)}>Close</button>
            </div>
            <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
              <label>
                Search Containers
                <input
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  placeholder="Type to filter..."
                />
              </label>
              <div style={{ maxHeight: 240, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                {loadingAvailable ? (
                  <div className="muted" style={{ padding: 12 }}>Loading containers...</div>
                ) : (
                  (availableContainers
                    .filter((container) => {
                      const label = `${container.name || ''} ${container.id || ''} ${formatContainerLocation(container) || ''}`
                        .toLowerCase()
                      return label.includes(assignSearch.toLowerCase())
                    })
                    .map((container) => (
                      <button
                        key={container.id}
                        className={assignContainerId === container.id ? 'btn' : 'btn ghost'}
                        style={{
                          justifyContent: 'space-between',
                          width: '100%',
                          borderRadius: 0
                        }}
                        onClick={() => setAssignContainerId(container.id)}
                      >
                        <span>{container.name || container.id}</span>
                        <span className="muted" style={{ fontSize: 12 }}>
                          {formatContainerLocation(container) || 'No location'}
                        </span>
                      </button>
                    )))
                )}
                {!loadingAvailable && availableContainers.length === 0 && (
                  <div className="muted" style={{ padding: 12 }}>No containers available.</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  className="btn ghost"
                  onClick={() => {
                    setShowAssignDrawer(false)
                    setShowCreateDrawer(true)
                  }}
                >
                  Create New Container
                </button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn ghost" onClick={() => setShowAssignDrawer(false)}>Cancel</button>
                  <button className="btn" onClick={handleAssignContainer} disabled={!assignContainerId || assigning}>
                    {assigning ? 'Assigning...' : 'Assign'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateDrawer && coldStorage && (
        <ContainerCreateDrawer
          onClose={() => setShowCreateDrawer(false)}
          initialColdStorageId={coldStorage.id}
          initialRackId={rack.id}
          initialRackPosition={assignPosition}
        />
      )}

      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Rack View</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={viewMode === 'grid' ? 'btn' : 'btn ghost'}
              onClick={() => setViewMode('grid')}
            >
              Grid
            </button>
            <button
              className={viewMode === 'list' ? 'btn' : 'btn ghost'}
              onClick={() => setViewMode('list')}
            >
              Containers
            </button>
          </div>
        </div>

        {viewMode === 'grid' ? (
          gridRows && gridCols ? (
            <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
              <div
                className="muted"
                style={{
                  fontSize: 12,
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  alignSelf: 'center'
                }}
              >
                Front of rack
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${gridCols}, minmax(120px, 1fr))`,
                  gap: 8,
                  flex: 1
                }}
              >
                {gridPositions.map((position) => {
                  const assigned = positionMap[position]
                  return (
                    <div
                      key={position}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: 8,
                        padding: 10,
                        minHeight: 72,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{position}</div>
                      </div>
                      {assigned ? (
                        <button
                          className="btn ghost"
                          style={{ justifyContent: 'space-between' }}
                          onClick={() => { window.location.hash = `#/containers/${assigned.id}` }}
                        >
                          <span>{assigned.name || assigned.id}</span>
                        </button>
                      ) : (
                        <button className="btn" onClick={() => openAssign(position)}>
                          Add Container
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="muted">Set grid rows and columns to view rack layout.</div>
          )
        ) : (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Containers</h3>
            {containers.length === 0 ? (
              <div className="muted">No containers found for this rack.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', background: '#f9fafb' }}>
                      <th style={{ padding: 8 }}>Container</th>
                      <th style={{ padding: 8 }}>Capacity</th>
                      <th style={{ padding: 8 }}>Storage Path</th>
                    </tr>
                  </thead>
                  <tbody>
                    {containers.map((container) => (
                      <tr key={container.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td style={{ padding: 8 }}>
                          <button
                            className="btn ghost"
                            style={{ padding: 0, height: 'auto' }}
                            onClick={() => { window.location.hash = `#/containers/${container.id}` }}
                          >
                            {container.name || container.id}
                          </button>
                        </td>
                        <td style={{ padding: 8 }}>
                          {container.used ?? 0}/{container.total ?? '-'}
                        </td>
                        <td style={{ padding: 8 }}>{formatContainerLocation(container) || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
