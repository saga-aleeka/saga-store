import { createClient } from '@supabase/supabase-js'

// Use Vite client envs in the browser. These envs are safe to expose to the client
const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || ''
const EXPECTED_SUPABASE_PROJECT_REF = ((import.meta as any).env?.VITE_EXPECTED_SUPABASE_PROJECT_REF || '').trim().toLowerCase()

function getProjectRef(url: string): string {
  if (!url) return ''
  try {
    const host = new URL(String(url)).hostname || ''
    return (host.split('.')[0] || '').trim().toLowerCase()
  } catch (_err) {
    return ''
  }
}

if (EXPECTED_SUPABASE_PROJECT_REF) {
  const actualProjectRef = getProjectRef(SUPABASE_URL)
  if (!actualProjectRef || actualProjectRef !== EXPECTED_SUPABASE_PROJECT_REF) {
    throw new Error('Supabase environment lock failed: VITE_SUPABASE_URL does not match VITE_EXPECTED_SUPABASE_PROJECT_REF')
  }
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  db: {
    schema: 'public',
  },
  global: {
    headers: { 'x-my-custom-header': 'saga-store' },
  },
})

export default supabase
