// Loading skeleton components
import React from 'react'

export function CardSkeleton() {
  return (
    <div className="card" style={{ animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}>
      <div style={{ height: 20, background: '#e5e7eb', borderRadius: 4, marginBottom: 12, width: '60%' }} />
      <div style={{ height: 16, background: '#f3f4f6', borderRadius: 4, marginBottom: 8 }} />
      <div style={{ height: 16, background: '#f3f4f6', borderRadius: 4, width: '80%' }} />
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: '#f3f4f6' }}>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i} style={{ padding: 12 }}>
                <div style={{ height: 16, background: '#e5e7eb', borderRadius: 4, width: '80%' }} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex} style={{ borderTop: '1px solid #e5e7eb' }}>
              {Array.from({ length: cols }).map((_, colIndex) => (
                <td key={colIndex} style={{ padding: 12 }}>
                  <div 
                    style={{ 
                      height: 16, 
                      background: '#f3f4f6', 
                      borderRadius: 4, 
                      width: colIndex === 0 ? '60%' : '90%',
                      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                    }} 
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function GridSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: 16
    }}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

export function TextSkeleton({ width = '100%', height = 16 }: { width?: string | number; height?: number }) {
  return (
    <div 
      style={{ 
        height, 
        width, 
        background: '#e5e7eb', 
        borderRadius: 4,
        animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
      }} 
    />
  )
}

// Add pulse animation to global styles
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `
  document.head.appendChild(style)
}
