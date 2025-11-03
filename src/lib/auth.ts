const TOKEN_KEY = 'saga_token'
const USER_KEY = 'saga_user'

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}

export function setToken(token: string | null){
  try{ if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY) }catch{}
}

export function clearToken(){ setToken(null); try{ localStorage.removeItem(USER_KEY) }catch{} }

export function getUser(){
  try{ const raw = localStorage.getItem(USER_KEY); return raw ? JSON.parse(raw) : null }catch{ return null }
}

export function setUser(user: any){
  try{ if (user) localStorage.setItem(USER_KEY, JSON.stringify(user)); else localStorage.removeItem(USER_KEY) }catch{}
}
