import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/api'
import { formatDate } from '../lib/dateUtils'

export default function ColdStorageList() {
  const [units, setUnits] = useState<any[]>([])
  const [racks, setRacks] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'units' | 'racks'>('units')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      setLoading(true)
      try {
        const [{ data: unitData }, { data: rackData }, { data: containerData }, { data: rackListData }] = await Promise.all([
          supabase.from('cold_storage_units').select('*').order('name', { ascending: true }),
          supabase.from('racks').select('id, cold_storage_id'),
          supabase.from('containers').select('id, cold_storage_id').eq('archived', false),
          supabase
            .from('racks')
            .select('id, name, position, grid_rows, grid_cols, cold_storage_units!racks_cold_storage_id_fkey(id, name, temperature)')
            .order('name', { ascending: true })
        ])

        if (!mounted) return

        const rackCounts = new Map<string, number>()
        rackData?.forEach((r: any) => {
          rackCounts.set(r.cold_storage_id, (rackCounts.get(r.cold_storage_id) || 0) + 1)
        })

        const containerCounts = new Map<string, number>()
        containerData?.forEach((c: any) => {
          if (!c.cold_storage_id) return
          containerCounts.set(c.cold_storage_id, (containerCounts.get(c.cold_storage_id) || 0) + 1)
        })

        const merged = (unitData || []).map((u: any) => ({
          ...u,
          rackCount: rackCounts.get(u.id) || 0,
          containerCount: containerCounts.get(u.id) || 0
        }))

        setUnits(merged)
        setRacks(rackListData || [])
      } catch (e) {
        console.error('Failed to load cold storage units:', e)
        if (mounted) setUnits([])
      } finally {
        if (mounted) setLoading(false)
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  if (loading) return <div className="muted">Loading cold storage...</div>

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div className="tabs" role="tablist" style={{ gap: 8 }}>
          <button
            className={activeTab === 'units' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('units')}
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            Storage Units
          </button>
          <button
            className={activeTab === 'racks' ? 'tab active' : 'tab'}
            onClick={() => setActiveTab('racks')}
            style={{ padding: '6px 12px', fontSize: 13 }}
          >
            Racks
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {activeTab === 'units' && (
            <button className="btn" onClick={() => { window.location.hash = '#/new-storage' }}>
              New Cold Storage
            </button>
          )}
          {activeTab === 'racks' && (
            <button className="btn" onClick={() => { window.location.hash = '#/new-rack' }}>
              New Rack
            </button>
          )}
        </div>
      </div>

      {activeTab === 'units' && (
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>INV Number</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Location</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Temperature</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Next PM Due</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Racks</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Containers</th>
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => (
                  <tr
                    key={unit.id}
                    style={{ borderTop: '1px solid #e5e7eb', cursor: 'pointer' }}
                    onClick={() => {
                      window.location.hash = `#/cold-storage/${unit.id}`
                    }}
                  >
                    <td style={{ padding: 12, fontWeight: 600, color: '#2563eb' }}>{unit.name}</td>
                    <td style={{ padding: 12 }}>{unit.location || '-'}</td>
                    <td style={{ padding: 12 }}>{unit.temperature || '-'}</td>
                    <td style={{ padding: 12 }}>{unit.pm_due_date ? formatDate(unit.pm_due_date) : '-'}</td>
                    <td style={{ padding: 12 }}>
                      {(() => {
                        const isOut = unit.status === 'out_of_service'
                        const label = isOut ? 'Out of Service' : 'In Service'
                        const color = isOut ? '#dc2626' : '#16a34a'
                        return (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '2px 10px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 600,
                              color,
                              background: `${color}22`
                            }}
                          >
                            {label}
                          </span>
                        )
                      })()}
                    </td>
                    <td style={{ padding: 12 }}>{unit.rackCount}</td>
                    <td style={{ padding: 12 }}>{unit.containerCount}</td>
                  </tr>
                ))}
                {!loading && units.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 16 }} className="muted">No storage units found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'racks' && (
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead style={{ background: '#f9fafb' }}>
                <tr>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Rack</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Storage Unit</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Position</th>
                  <th style={{ padding: 12, textAlign: 'left', fontWeight: 600 }}>Grid</th>
                </tr>
              </thead>
              <tbody>
                {racks.map((rack) => (
                  <tr
                    key={rack.id}
                    style={{ borderTop: '1px solid #e5e7eb', cursor: 'pointer' }}
                    onClick={() => {
                      window.location.hash = `#/racks/${rack.id}`
                    }}
                  >
                    <td style={{ padding: 12, fontWeight: 600, color: '#2563eb' }}>{rack.name}</td>
                    <td style={{ padding: 12 }}>{rack.cold_storage_units?.name || '-'}</td>
                    <td style={{ padding: 12 }}>{rack.position || '-'}</td>
                    <td style={{ padding: 12 }}>{rack.grid_rows && rack.grid_cols ? `${rack.grid_rows}x${rack.grid_cols}` : '-'}</td>
                  </tr>
                ))}
                {!loading && racks.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: 16 }} className="muted">No racks found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
