import React from 'react'

interface ConfirmOverwriteDialogProps {
  occupyingSample: {
    sample_id: string
    position: string
  }
  newSample: {
    sample_id: string
    position: string
  }
  containerName: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmOverwriteDialog({
  occupyingSample,
  newSample,
  containerName,
  onConfirm,
  onCancel
}: ConfirmOverwriteDialogProps) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 12,
          padding: 24,
          maxWidth: 500,
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16}}>
          <div style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            background: '#fef3c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
          }}>
            ⚠️
          </div>
          <div>
            <h3 style={{margin: 0, fontSize: 18, fontWeight: 600, color: '#111827'}}>
              Position Already Occupied
            </h3>
            <p style={{margin: '4px 0 0', fontSize: 14, color: '#6b7280'}}>
              This action will displace an existing sample
            </p>
          </div>
        </div>

        <div style={{
          background: '#f9fafb',
          borderRadius: 8,
          padding: 16,
          marginBottom: 20,
          border: '1px solid #e5e7eb',
        }}>
          <div style={{marginBottom: 12}}>
            <div style={{fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 600}}>
              Container
            </div>
            <div style={{fontSize: 14, color: '#374151', fontWeight: 500}}>
              {containerName}
            </div>
          </div>

          <div style={{marginBottom: 12}}>
            <div style={{fontSize: 12, color: '#6b7280', marginBottom: 4, fontWeight: 600}}>
              Position
            </div>
            <div style={{
              display: 'inline-block',
              padding: '4px 8px',
              background: '#dbeafe',
              color: '#1e40af',
              borderRadius: 4,
              fontSize: 14,
              fontWeight: 600,
            }}>
              {occupyingSample.position}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: 12,
            alignItems: 'center',
          }}>
            <div>
              <div style={{fontSize: 12, color: '#dc2626', marginBottom: 4, fontWeight: 600}}>
                Current Sample
              </div>
              <div style={{
                padding: '8px 12px',
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
              }}>
                {occupyingSample.sample_id}
              </div>
              <div style={{fontSize: 11, color: '#6b7280', marginTop: 4}}>
                Will be checked out
              </div>
            </div>

            <div style={{fontSize: 24}}>→</div>

            <div>
              <div style={{fontSize: 12, color: '#059669', marginBottom: 4, fontWeight: 600}}>
                New Sample
              </div>
              <div style={{
                padding: '8px 12px',
                background: '#d1fae5',
                color: '#065f46',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
              }}>
                {newSample.sample_id}
              </div>
              <div style={{fontSize: 11, color: '#6b7280', marginTop: 4}}>
                Will replace current
              </div>
            </div>
          </div>
        </div>

        <p style={{fontSize: 14, color: '#374151', marginBottom: 20, lineHeight: 1.5}}>
          The displaced sample <strong>{occupyingSample.sample_id}</strong> will be checked out 
          and can be found in the "Checked Out" samples list. Its previous position will be saved 
          so it can be restored later.
        </p>

        <div style={{display: 'flex', gap: 12, justifyContent: 'flex-end'}}>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              border: '1px solid #d1d5db',
              borderRadius: 8,
              background: 'white',
              color: '#374151',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              border: 'none',
              borderRadius: 8,
              background: '#f59e0b',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Confirm Overwrite
          </button>
        </div>
      </div>
    </div>
  )
}
