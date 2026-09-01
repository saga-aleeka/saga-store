export const SAMPLE_TYPES = [
  'Sample Type',
  'cfDNA Tubes',
  'DP Pools',
  'DTC Tubes',
  'PA Pools',
  'MNC Tubes',
  'Plasma Tubes',
  'BC Tubes',
  'IDT Plates',
  'Other',
]

export const SAMPLE_TYPE_META: Record<string, { label: string; color: string }> = {
  'PA Pools': { label: 'PA Pools', color: '#fb923c' },
  'DP Pools': { label: 'DP Pools', color: '#10b981' },
  'cfDNA Tubes': { label: 'cfDNA Tubes', color: '#9ca3af' },
  'DTC Tubes': { label: 'DTC Tubes', color: '#7c3aed' },
  'MNC Tubes': { label: 'MNC Tubes', color: '#ef4444' },
  'Plasma Tubes': { label: 'Plasma Tubes', color: '#f59e0b' },
  'BC Tubes': { label: 'BC Tubes', color: '#3b82f6' },
  'IDT Plates': { label: 'IDT Plates', color: '#06b6d4' },
  'Sample Type': { label: 'Sample Type', color: '#6b7280' },
  'Other': { label: 'Other', color: '#1f2937' },
}

export const SAMPLE_TYPE_OPTIONS = Object.entries(SAMPLE_TYPE_META).map(([key, value]) => ({
  key,
  label: value.label,
  color: value.color,
})).filter((option) => option.key !== 'Sample Type')

export const COLD_STORAGE_LOCATIONS = [
  'Lab A',
  'Lab B TZ',
  'Lab B TF',
  'Lab D',
  'Lab E'
] as const

export const LAYOUTS = ['9x9','5x5','14x7']
export const TEMPS = ['-80°C','-20°C','4°C']
