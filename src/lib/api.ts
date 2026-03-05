export function getApiBase(){
  // Vite exposes env vars as import.meta.env.VITE_*
  // If VITE_API_BASE is set, use it (no trailing slash), otherwise default to '' (same origin)
  const base = ((import.meta as any).env?.VITE_API_BASE as string) || ''
  return base.replace(/\/$/, '') // remove trailing slash
}

export function getApiUrl(path: string){
  if (!path) return path
  // If path is absolute (starts with http), return as-is
  if (/^https?:\/\//i.test(path)) return path
  // Allow VITE_API_BASE to proxy /api/* when configured
  const base = getApiBase()
  if (path.startsWith('/api/')) return base ? `${base}${path}` : path
  // If path already contains the base, return as-is
  if (base && path.startsWith(base)) return path
  // If path is absolute on origin (/api/...), prefix base
  if (path.startsWith('/')) return base + path
  // otherwise treat as relative path
  return base ? `${base}/${path}` : path
}

// Expose the supabase client for parts of the app that prefer it.
import { supabase } from './supabaseClient'
export { supabase }

import { getToken, getUser } from './auth'

export async function apiFetch(input: string, init?: RequestInit){
  const url = getApiUrl(input)
  const token = getToken()
  const user = getUser()
  const headers = new Headers(init?.headers as HeadersInit)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (user?.initials) headers.set('X-User-Initials', user.initials)
  if (user?.name) headers.set('X-User-Name', user.name)
  return fetch(url, { ...init, headers })
}
