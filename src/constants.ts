// Legacy constants - SAMPLE_TYPES and LAYOUTS are now managed in the database
// via sample_types and container_types tables. Use the API endpoints to fetch them.
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
]

export const LAYOUTS = ['9x9','5x5','14x7']

// Temperature options (still used in forms)
export const TEMPS = ['-80°C','-20°C','4°C']
