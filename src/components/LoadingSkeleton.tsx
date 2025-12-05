import React from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
  className?: string
}

export function Skeleton({ width = '100%', height = 20, borderRadius = 4, className = '' }: SkeletonProps) {
  return (
    <div 
      className={`skeleton ${className}`}
      style={{
        width,
        height,
        borderRadius,
        background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite'
      }}
    />
  )
}

export function ContainerCardSkeleton() {
  return (
    <div style={{
      background: 'white',
      borderRadius: 8,
      padding: 16,
      border: '1px solid #e5e7eb',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height={24} />
          <div style={{ marginTop: 8 }}>
            <Skeleton width="40%" height={16} />
          </div>
        </div>
        <Skeleton width={80} height={24} borderRadius={12} />
      </div>
      
      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
        <div style={{ flex: 1 }}>
          <Skeleton width="50%" height={14} />
          <div style={{ marginTop: 4 }}>
            <Skeleton width="70%" height={14} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <Skeleton width="50%" height={14} />
          <div style={{ marginTop: 4 }}>
            <Skeleton width="70%" height={14} />
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <Skeleton width={60} height={28} borderRadius={4} />
        <Skeleton width={60} height={28} borderRadius={4} />
        <Skeleton width={60} height={28} borderRadius={4} />
      </div>
    </div>
  )
}

export function AuditLogSkeleton() {
  return (
    <div style={{
      marginTop: 8,
      padding: 12,
      background: '#f9fafb',
      borderRadius: 6,
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start'
    }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Skeleton width={70} height={24} borderRadius={4} />
          <Skeleton width={70} height={24} borderRadius={4} />
          <Skeleton width={50} height={24} borderRadius={4} />
        </div>
        <Skeleton width="80%" height={16} />
      </div>
      <Skeleton width={100} height={14} />
    </div>
  )
}

export function GridViewSkeleton() {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Skeleton width={200} height={28} />
          <div style={{ marginTop: 8 }}>
            <Skeleton width={300} height={16} />
          </div>
        </div>
        <Skeleton width={100} height={36} borderRadius={6} />
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {[...Array(6)].map((_, i) => (
          <ContainerCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

export function WorklistSkeleton() {
  return (
    <div style={{ padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <Skeleton width={150} height={28} />
        <div style={{ marginTop: 8 }}>
          <Skeleton width={250} height={16} />
        </div>
      </div>
      
      <div style={{ background: 'white', borderRadius: 8, border: '1px solid #e5e7eb', padding: 16 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Skeleton width="100%" height={40} borderRadius={6} />
          <Skeleton width={120} height={40} borderRadius={6} />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: 8 }}>
              <Skeleton width={40} height={40} borderRadius={4} />
              <div style={{ flex: 1 }}>
                <Skeleton width="60%" height={16} />
                <div style={{ marginTop: 4 }}>
                  <Skeleton width="40%" height={14} />
                </div>
              </div>
              <Skeleton width={80} height={20} borderRadius={10} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 12, padding: 12, background: '#f9fafb', borderRadius: 6 }}>
        {[...Array(columns)].map((_, i) => (
          <Skeleton key={i} width="70%" height={16} />
        ))}
      </div>
      
      {/* Rows */}
      {[...Array(rows)].map((_, rowIndex) => (
        <div key={rowIndex} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: 12, padding: 12, borderBottom: '1px solid #e5e7eb' }}>
          {[...Array(columns)].map((_, colIndex) => (
            <Skeleton key={colIndex} width={colIndex === 0 ? '90%' : '60%'} height={16} />
          ))}
        </div>
      ))}
    </div>
  )
}
