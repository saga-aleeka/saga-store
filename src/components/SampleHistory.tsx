import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../lib/supabaseClient'
import { getToken } from '../lib/auth'
import { formatDateTime } from '../lib/dateUtils'

interface SampleHistoryProps {
  sampleId: string
  onBack: () => void
}

const normalizeSampleForMatching = (value: string) =>
  String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')

const getCoreSampleKeys = (value: string) => {
  const normalized = normalizeSampleForMatching(value)
  if (!normalized) return []

  const keys = new Set<string>([normalized])

  if (normalized.length > 4) {
    const trailingTrimmed = normalized.replace(/(?:[A-Z]|[0-9])$/, '')
    if (trailingTrimmed && trailingTrimmed !== normalized) keys.add(trailingTrimmed)

    const alphaPrefix = normalized.match(/^([A-Z]+\d+)/)?.[1]
    if (alphaPrefix) keys.add(alphaPrefix)

    for (let end = normalized.length - 1; end >= Math.max(4, normalized.length - 6); end--) {
      const segment = normalized.slice(0, end)
      if (segment.length >= 4) keys.add(segment)
    }
  }

  return [...keys]
}

export default function SampleHistory({ sampleId, onBack }: SampleHistoryProps) {
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [containerNames, setContainerNames] = useState<Map<string, string>>(new Map())
  const [sample, setSample] = useState<any>(null)
  const [relatedSamples, setRelatedSamples] = useState<any[]>([])
  const [containerPreview, setContainerPreview] = useState<any | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    async function loadData() {
      setLoading(true)
      try {
        const { data: sampleRows, error: sampleError } = await supabase
          .from('samples')
          .select('*, containers!samples_container_id_fkey(id, name, location, type), previous_containers:containers!samples_previous_container_id_fkey(id, name, location, type)')
          .eq('sample_id', sampleId)
          .order('is_archived', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(1)

        if (sampleError) {
          console.error('Error loading sample:', sampleError)
        } else if (sampleRows && sampleRows.length > 0) {
          setSample(sampleRows[0])
        }

        const matchKeys = getCoreSampleKeys(sampleId)
        const orClause = matchKeys.length > 0 ? matchKeys.map((key) => `sample_id.ilike.%${key}%`).join(',') : 'sample_id.ilike.%'

        const { data: relatedRows, error: relatedError } = await supabase
          .from('samples')
          .select('id, sample_id, container_id, position, is_checked_out, is_archived, containers!samples_container_id_fkey(id, name, location, type)')
          .or(orClause)
          .neq('sample_id', sampleId)
          .order('created_at', { ascending: false })
          .limit(25)

        if (relatedError) {
          console.error('Error loading related samples:', relatedError)
          setRelatedSamples([])
        } else {
          const filtered = (relatedRows || []).filter((row: any) => {
            if (!row?.sample_id) return false
            const rowKey = normalizeSampleForMatching(row.sample_id)
            return matchKeys.some((key) => {
              const normalizedKey = normalizeSampleForMatching(key)
              return rowKey.includes(normalizedKey) || normalizedKey.includes(rowKey)
            })
          })
          setRelatedSamples(filtered)
        }

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

          const containerIds = new Set<string>()
          auditData?.forEach((audit: any) => {
            if (audit.metadata?.container_id) containerIds.add(audit.metadata.container_id)
            if (audit.metadata?.from_container) containerIds.add(audit.metadata.from_container)
            if (audit.metadata?.to_container) containerIds.add(audit.metadata.to_container)
            if (audit.metadata?.previous_container_id) containerIds.add(audit.metadata.previous_container_id)
          })

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

  const openContainerPreview = async (containerId: string | null, focusSampleId?: string) => {
    if (!containerId) return

    setPreviewLoading(true)
    try {
      const { data: containerData, error: containerError } = await supabase
        .from('containers')
        .select('id, name, location, type, layout, temperature')
        .eq('id', containerId)
        .single()

      if (containerError) throw containerError

      const { data: containerSamples, error: sampleError } = await supabase
        .from('samples')
        .select('id, sample_id, position, is_checked_out, is_archived, container_id')
        .eq('container_id', containerId)
        .order('position', { ascending: true })

      if (sampleError) throw sampleError

      setContainerPreview({
        ...containerData,
        samples: containerSamples || [],
        focusSampleId: focusSampleId || sampleId
      })
    } catch (error) {
      console.error('Error loading container preview:', error)
      toast.error('Unable to load sample location preview')
    } finally {
      setPreviewLoading(false)
    }
  }

  const handlePreviewCheckout = async (sampleToCheckout: any) => {
    if (!sampleToCheckout) return
    try {
      const token = getToken()
      const res = await apiFetch(`/api/samples/${sampleToCheckout.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'checkout' })
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => null)
        throw new Error(payload?.message || payload?.error || 'Failed to checkout sample')
      }

      toast.success(`Checked out ${sampleToCheckout.sample_id}`)
      setContainerPreview(null)
      window.dispatchEvent(new CustomEvent('samples-updated'))
      window.location.hash = '#/worklist'
    } catch (error: any) {
      console.error('Checkout preview error:', error)
      toast.error(error?.message || 'Failed to checkout sample')
    }
  }

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
    } else if (audit.action === 'tag_added') {
      const tagName = metadata.tag_name || metadata.tag_id || 'tag'
      description = `Tag added: ${tagName}`
    } else if (audit.action === 'tag_removed') {
      const tagName = metadata.tag_name || metadata.tag_id || 'tag'
      description = `Tag removed: ${tagName}`
    } else if (audit.action === 'tags_added') {
      const tags = (metadata.tags || []).map((t: any) => t.name).filter(Boolean)
      description = tags.length ? `Tags added: ${tags.join(', ')}` : 'Tags added'
    }

    return { description, details }
  }

  return (
    <div style={{ maxWidth: 1240, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(0, 1.6fr) minmax(300px, 0.9fr)', gap: 24 }}>
      <div>
        <div style={{ marginBottom: 24 }}>
          <button 
            className="btn ghost" 
            onClick={onBack}
            style={{ marginBottom: 16 }}
          >
            ← Back to Samples
          </button>

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
                      <div className="muted" style={{ fontSize: 12 }}>Location</div>
                      <button
                        className="btn ghost"
                        style={{ marginTop: 4, padding: '4px 8px', fontWeight: 600 }}
                        onClick={() => openContainerPreview(sample.container_id, sample.sample_id)}
                      >
                        {sample.containers.location || '-'}
                      </button>
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
            <div style={{
              position: 'absolute',
              left: 20,
              top: 0,
              bottom: 0,
              width: 2,
              background: '#e5e7eb'
            }} />

            {auditLogs.map((audit) => {
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

      <aside style={{
        background: '#f9fafb',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 16,
        alignSelf: 'start',
        position: 'sticky',
        top: 16
      }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 700 }}>Connected Samples</h3>

        {relatedSamples.length === 0 ? (
          <div className="muted">No matching linked sample IDs found.</div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {relatedSamples.map((row: any) => (
              <button
                key={row.id}
                className="btn ghost"
                style={{ padding: '10px 12px', textAlign: 'left', display: 'grid', gap: 4 }}
                onClick={() => openContainerPreview(row.container_id, row.sample_id)}
              >
                <div style={{ fontWeight: 700 }}>{row.sample_id}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {row.containers?.name || 'Unknown container'} • {row.containers?.location || 'Unknown location'}
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {row.position || 'Unknown position'}
                </div>
              </button>
            ))}
          </div>
        )}
      </aside>

      {containerPreview && (
        <div className="drawer-overlay" onClick={() => setContainerPreview(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0 }}>{containerPreview.name}</h3>
              <button className="btn ghost" onClick={() => setContainerPreview(null)}>Close</button>
            </div>

            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <div className="muted">{containerPreview.location || 'Unknown location'}</div>
              <div className="muted">{containerPreview.type || 'Unknown type'} • {containerPreview.temperature || 'Unknown temperature'}</div>

              {previewLoading ? (
                <div className="muted">Loading container...</div>
              ) : (
                <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                  {containerPreview.samples?.length ? containerPreview.samples.map((item: any) => (
                    <button
                      key={item.id}
                      className="btn ghost"
                      onClick={() => handlePreviewCheckout(item)}
                      style={{
                        textAlign: 'left',
                        background: item.sample_id === containerPreview.focusSampleId ? '#ecfeff' : undefined,
                        borderColor: item.sample_id === containerPreview.focusSampleId ? '#67e8f9' : undefined,
                        padding: '8px 10px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ fontWeight: item.sample_id === containerPreview.focusSampleId ? 700 : 500 }}>{item.sample_id}</span>
                      <span className="muted" style={{ fontSize: 12 }}>{item.position || 'Unassigned'}</span>
                    </button>
                  )) : (
                    <div className="muted">No samples found in this container.</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
