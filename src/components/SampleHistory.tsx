import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { formatDateTime } from '../lib/dateUtils'
import { CONTAINER_LOCATION_SELECT, formatContainerLocation } from '../lib/locationUtils'
import LocationBreadcrumb from './LocationBreadcrumb'

interface SampleHistoryProps {
  sampleId: string
  onBack: () => void
}

export default function SampleHistory({ sampleId, onBack }: SampleHistoryProps) {
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [containerNames, setContainerNames] = useState<Map<string, string>>(new Map())
  const [sample, setSample] = useState<any>(null)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        // Load sample data
        const { data: sampleData, error: sampleError } = await supabase
          .from('samples')
          .select(`*, containers:containers!samples_container_id_fkey(${CONTAINER_LOCATION_SELECT}), previous_containers:containers!samples_previous_container_id_fkey(${CONTAINER_LOCATION_SELECT})`)
          .eq('sample_id', sampleId)
          .single()
        
        if (sampleError && sampleError.code !== 'PGRST116') {
          console.error('Error loading sample:', sampleError)
        } else if (sampleData) {
          setSample(sampleData)
        }

        // Load audit logs for this sample
        const { data: auditData, error: auditError } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('entity_type', 'sample')
          .eq('entity_name', sampleId)
          .order('created_at', { ascending: false })

        if (auditError) {
          console.error('Error loading audit logs:', auditError)
          setAuditLogs([])
        } else {
          setAuditLogs(auditData || [])

          // Collect all container IDs from audit metadata
          const containerIds = new Set<string>()
          auditData?.forEach((audit: any) => {
            if (audit.metadata?.container_id) containerIds.add(audit.metadata.container_id)
            if (audit.metadata?.from_container) containerIds.add(audit.metadata.from_container)
            if (audit.metadata?.to_container) containerIds.add(audit.metadata.to_container)
            if (audit.metadata?.previous_container_id) containerIds.add(audit.metadata.previous_container_id)
          })

          // Fetch container names
          if (containerIds.size > 0) {
            const { data: containers } = await supabase
              .from('containers')
              .select('id, name')
              .in('id', Array.from(containerIds))

            const nameMap = new Map<string, string>()
            containers?.forEach((c: any) => nameMap.set(c.id, c.name))
            setContainerNames(nameMap)
          }
        }
      } catch (err) {
        console.error('Error loading sample history:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [sampleId])

  const renderAuditEvent = (audit: any) => {
    const metadata = audit.metadata || {}
    
    // Build description based on action
    let description = audit.description || ''
    let details: string[] = []

    if (audit.action === 'created' || audit.action === 'inserted') {
      const container = containerNames.get(metadata.container_id) || metadata.container_id?.substring(0, 8) || 'Unknown'
      const position = metadata.position || '?'
      description = `Sample created in ${container} at position ${position}`
    } else if (audit.action === 'moved') {
      const fromContainer = containerNames.get(metadata.from_container) || metadata.from_container?.substring(0, 8) || 'Unknown'
      const toContainer = containerNames.get(metadata.to_container) || metadata.to_container?.substring(0, 8) || 'Unknown'
      const fromPos = metadata.from_position || '?'
      const toPos = metadata.to_position || '?'
      
      if (fromContainer === toContainer) {
        description = `Moved within ${toContainer}`
        details.push(`${fromPos} → ${toPos}`)
      } else {
        description = `Moved from ${fromContainer} to ${toContainer}`
        details.push(`${fromPos} → ${toPos}`)
      }
    } else if (audit.action === 'checked_out') {
      const container = containerNames.get(metadata.previous_container_id) || metadata.previous_container_id?.substring(0, 8) || 'Unknown'
      const position = metadata.previous_position || '?'
      description = `Checked out from ${container}`
      details.push(`Position: ${position}`)
      if (metadata.displaced_by) {
        details.push(`Displaced by: ${metadata.displaced_by}`)
      }
    } else if (audit.action === 'checked_in') {
      const container = containerNames.get(metadata.container_id) || metadata.container_id?.substring(0, 8) || 'Unknown'
      const position = metadata.position || '?'
      description = `Checked back in to ${container}`
      details.push(`Position: ${position}`)
    } else if (audit.action === 'archived') {
      const container = containerNames.get(metadata.container_id) || metadata.container_id?.substring(0, 8) || 'Unknown'
      description = `Archived from ${container}`
      if (metadata.position) details.push(`Position: ${metadata.position}`)
    } else if (audit.action === 'unarchived') {
      const container = containerNames.get(metadata.container_id) || metadata.container_id?.substring(0, 8) || 'Unknown'
      description = `Restored from archive to ${container}`
      if (metadata.position) details.push(`Position: ${metadata.position}`)
    } else if (audit.action === 'deleted') {
      const container = containerNames.get(metadata.container_id) || metadata.container_id?.substring(0, 8) || 'Unknown'
      description = `Permanently deleted from ${container}`
      if (metadata.position) details.push(`Position: ${metadata.position}`)
    } else if (audit.action === 'marked_training') {
      description = `Marked as training sample`
    } else if (audit.action === 'unmarked_training') {
      description = `Training flag removed`
    } else if (audit.action === 'updated') {
      description = `Sample updated`
      if (metadata.container_id) {
        const container = containerNames.get(metadata.container_id) || metadata.container_id?.substring(0, 8)
        details.push(`Container: ${container}`)
      }
      if (metadata.position) details.push(`Position: ${metadata.position}`)
    }

    return { description, details }
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <button 
          className="btn ghost" 
          onClick={onBack}
          style={{ marginBottom: 16 }}
        >
          ← Back to Samples
        </button>

        {(() => {
          const container = sample?.containers || sample?.previous_containers
          const rack = container?.racks
          const coldStorage = rack?.cold_storage_units || container?.cold_storage_units
          const breadcrumbItems = [
            ...(coldStorage ? [{ label: coldStorage.name, href: `#/cold-storage/${coldStorage.id}` }] : []),
            ...(rack ? [{ label: rack.name, href: `#/racks/${rack.id}` }] : []),
            ...(container ? [{ label: container.name || container.id, href: `#/containers/${container.id}` }] : []),
            { label: sampleId }
          ]

          return <LocationBreadcrumb items={breadcrumbItems} />
        })()}

        <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>
          Sample History: {sampleId}
        </h2>
        
        {sample && (
          <div style={{ 
            padding: 16, 
            background: '#f9fafb', 
            borderRadius: 8, 
            border: '1px solid #e5e7eb',
            marginBottom: 16 
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <div className="muted" style={{ fontSize: 12 }}>Current Status</div>
                <div style={{ fontWeight: 600, marginTop: 4 }}>
                  {sample.is_checked_out ? (
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      background: '#fef3c7',
                      color: '#92400e',
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 500
                    }}>
                      Checked Out
                    </span>
                  ) : sample.is_archived ? (
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      background: '#fee2e2',
                      color: '#991b1b',
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 500
                    }}>
                      Archived
                    </span>
                  ) : sample.container_id ? (
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      background: '#d1fae5',
                      color: '#065f46',
                      borderRadius: 4,
                      fontSize: 13,
                      fontWeight: 500
                    }}>
                      In Container
                    </span>
                  ) : (
                    'Unknown'
                  )}
                </div>
              </div>
              
              {sample.container_id && sample.containers && (
                <>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Container</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>{sample.containers.name}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Position</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>{sample.position || '-'}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Storage Path</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>{formatContainerLocation(sample.containers) || '-'}</div>
                  </div>
                </>
              )}
              
              {sample.is_checked_out && sample.previous_containers && (
                <>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Previous Container</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>{sample.previous_containers.name}</div>
                  </div>
                  <div>
                    <div className="muted" style={{ fontSize: 12 }}>Previous Position</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>{sample.previous_position || '-'}</div>
                  </div>
                  {sample.checked_out_by && (
                    <div>
                      <div className="muted" style={{ fontSize: 12 }}>Checked Out By</div>
                      <div style={{ fontWeight: 600, marginTop: 4 }}>{sample.checked_out_by}</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
        Activity Timeline
      </h3>

      {loading && <div className="muted">Loading history...</div>}
      
      {!loading && auditLogs.length === 0 && (
        <div className="muted" style={{ padding: 24, textAlign: 'center', background: '#f9fafb', borderRadius: 8 }}>
          No history found for this sample
        </div>
      )}

      {!loading && auditLogs.length > 0 && (
        <div style={{ position: 'relative' }}>
          {/* Timeline line */}
          <div style={{
            position: 'absolute',
            left: 20,
            top: 0,
            bottom: 0,
            width: 2,
            background: '#e5e7eb'
          }} />

          {auditLogs.map((audit, index) => {
            const { description, details } = renderAuditEvent(audit)
            
            return (
              <div 
                key={audit.id} 
                style={{ 
                  position: 'relative',
                  marginBottom: 24,
                  paddingLeft: 48
                }}
              >
                {/* Timeline dot */}
                <div style={{
                  position: 'absolute',
                  left: 12,
                  top: 4,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: audit.action === 'deleted' ? '#fee2e2' : 
                             audit.action === 'created' ? '#dcfce7' : 
                             audit.action === 'checked_out' ? '#fef3c7' :
                             audit.action === 'moved' ? '#e0e7ff' : '#e5e7eb',
                  border: '3px solid white',
                  boxShadow: '0 0 0 1px #e5e7eb'
                }} />

                <div style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: 8,
                  padding: 16
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span style={{
                          padding: '2px 8px',
                          background: audit.action === 'deleted' ? '#fee2e2' : 
                                     audit.action === 'created' ? '#dcfce7' : 
                                     audit.action === 'checked_out' ? '#fef3c7' :
                                     audit.action === 'moved' ? '#e0e7ff' :
                                     audit.action === 'archived' ? '#fed7aa' : '#e5e7eb',
                          color: audit.action === 'deleted' ? '#991b1b' : 
                                audit.action === 'created' ? '#166534' : 
                                audit.action === 'checked_out' ? '#92400e' :
                                audit.action === 'moved' ? '#3730a3' :
                                audit.action === 'archived' ? '#9a3412' : '#374151',
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 600,
                          textTransform: 'uppercase'
                        }}>
                          {audit.action}
                        </span>
                        
                        {audit.user_initials && (
                          <span style={{
                            fontSize: 13,
                            color: '#6b7280',
                            fontWeight: 500
                          }}>
                            by <strong>{audit.user_initials}</strong>
                          </span>
                        )}
                      </div>
                      
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                        {description}
                      </div>
                      
                      {details.length > 0 && (
                        <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                          {details.join(' • ')}
                        </div>
                      )}
                    </div>
                    
                    <div className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap', marginLeft: 12 }}>
                      {formatDateTime(audit.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
