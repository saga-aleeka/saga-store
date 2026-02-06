import React from 'react'

type BreadcrumbItem = {
  label: string
  href?: string
}

export default function LocationBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (!items || items.length === 0) return null

  return (
    <nav aria-label="Breadcrumb" style={{ marginBottom: 12 }}>
      <ol style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', color: '#6b7280', fontSize: 13 }}>
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1
          return (
            <li key={`${item.label}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {item.href && !isLast ? (
                <a href={item.href} style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>
                  {item.label}
                </a>
              ) : (
                <span style={{ color: '#111827', fontWeight: 600 }}>{item.label}</span>
              )}
              {!isLast && <span style={{ color: '#9ca3af' }}>›</span>}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
