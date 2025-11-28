import type { Admin, Player, ChatMessage, AdminSession } from '@seedhunter/shared'

const API_BASE = import.meta.env.VITE_API_URL || 'https://seedhunter.seedplex.io'

// Dynamic import for Capacitor Preferences (native-only)
async function getPreferences() {
  try {
    const pkgName = '@capacitor' + '/preferences'
    const mod = await import(/* @vite-ignore */ pkgName)
    return mod.Preferences
  } catch {
    // Fallback to localStorage for web/dev
    return {
      async set({ key, value }: { key: string; value: string }) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(key, value)
        }
      },
      async get({ key }: { key: string }) {
        if (typeof localStorage !== 'undefined') {
          return { value: localStorage.getItem(key) }
        }
        return { value: null }
      },
      async remove({ key }: { key: string }) {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(key)
        }
      }
    }
  }
}

// Token management using Capacitor Preferences (secure storage)
let authToken: string | null = null

export async function setAuthToken(token: string | null) {
  const Preferences = await getPreferences()
  authToken = token
  if (token) {
    await Preferences.set({ key: 'admin_token', value: token })
  } else {
    await Preferences.remove({ key: 'admin_token' })
  }
}

export async function getAuthToken(): Promise<string | null> {
  if (!authToken) {
    const Preferences = await getPreferences()
    const { value } = await Preferences.get({ key: 'admin_token' })
    authToken = value
  }
  return authToken
}

// Generic fetch wrapper
async function api<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken()
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    // ngrok requires this header to skip the browser warning page
    'ngrok-skip-browser-warning': 'true',
    ...options.headers,
  }
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }
  
  const url = `${API_BASE}${endpoint}`
  console.log(`[API] ${options.method || 'GET'} ${url}`)
  console.log(`[API] API_BASE:`, API_BASE)
  console.log(`[API] Headers:`, JSON.stringify(headers))
  console.log(`[API] Body:`, options.body)
  
  try {
    console.log(`[API] About to fetch...`)
    const response = await fetch(url, {
      ...options,
      headers,
    })
    
    console.log(`[API] Response received:`, response.status, response.statusText)
    console.log(`[API] Response headers:`, [...response.headers.entries()])
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[API] Error response body:`, errorText)
      let error = { error: 'Request failed' }
      try {
        error = JSON.parse(errorText)
      } catch {}
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    
    const data = await response.json()
    console.log(`[API] Response data:`, data)
    return data
  } catch (err) {
    console.error(`[API] Fetch error:`, err)
    console.error(`[API] Error name:`, (err as Error)?.name)
    console.error(`[API] Error message:`, (err as Error)?.message)
    console.error(`[API] Error stack:`, (err as Error)?.stack)
    throw err
  }
}

// ============================================
// Auth
// ============================================

export async function login(username: string, password: string): Promise<AdminSession> {
  const result = await api<AdminSession>('/auth/admin/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  await setAuthToken(result.token)
  return result
}

export async function logout(): Promise<void> {
  await api('/auth/logout', { method: 'POST' })
  await setAuthToken(null)
}

export async function refreshToken(): Promise<AdminSession> {
  const result = await api<AdminSession>('/auth/admin/refresh', { method: 'POST' })
  await setAuthToken(result.token)
  return result
}

// ============================================
// Location
// ============================================

export async function updateLocation(lat: number, lng: number): Promise<void> {
  await api('/admin/location', {
    method: 'POST',
    body: JSON.stringify({ lat, lng }),
  })
}

export async function setVisibility(visible: boolean): Promise<void> {
  await api('/admin/visibility', {
    method: 'PATCH',
    body: JSON.stringify({ visible }),
  })
}

// ============================================
// Verification
// ============================================

export async function verifyPlayer(handle: string): Promise<{
  success: boolean
  player: Player
  tradesVerified: number
}> {
  return api(`/admin/verify/${encodeURIComponent(handle)}`, { method: 'POST' })
}

export async function getPlayerByHandle(handle: string): Promise<Player | null> {
  try {
    return await api(`/players/${encodeURIComponent(handle)}`)
  } catch {
    return null
  }
}

// ============================================
// Chat Moderation
// ============================================

export async function deleteMessage(msgId: string): Promise<void> {
  await api(`/chat/${msgId}`, { method: 'DELETE' })
}

export async function getChatMessages(limit = 100): Promise<ChatMessage[]> {
  const result = await api<{ messages: ChatMessage[] }>(`/chat/messages?limit=${limit}`)
  return result.messages
}
