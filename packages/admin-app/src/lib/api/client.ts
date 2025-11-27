import { Preferences } from '@capacitor/preferences'
import type { Admin, Player, ChatMessage, AdminSession } from '@seedhunter/shared'

const API_BASE = import.meta.env.VITE_API_URL || 'https://seedhunter.seedplex.io'

// Token management using Capacitor Preferences (secure storage)
let authToken: string | null = null

export async function setAuthToken(token: string | null) {
  authToken = token
  if (token) {
    await Preferences.set({ key: 'admin_token', value: token })
  } else {
    await Preferences.remove({ key: 'admin_token' })
  }
}

export async function getAuthToken(): Promise<string | null> {
  if (!authToken) {
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
    ...options.headers,
  }
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  
  return response.json()
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
