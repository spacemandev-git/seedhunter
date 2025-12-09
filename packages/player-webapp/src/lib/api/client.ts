import { Routes, type Player, type LeaderboardEntry, type Card, type Trade, type AdminLocation, type ApiResponse, type PaginatedResponse, type GridProject, type GeoLocation, type Founder } from '@seedhunter/shared'

const API_BASE = import.meta.env.VITE_API_URL || '/api'

// Token storage
let authToken: string | null = null

export function setAuthToken(token: string | null) {
  authToken = token
  if (token) {
    localStorage.setItem('auth_token', token)
  } else {
    localStorage.removeItem('auth_token')
  }
}

export function getAuthToken(): string | null {
  if (!authToken) {
    authToken = localStorage.getItem('auth_token')
  }
  return authToken
}

// Generic fetch wrapper
async function api<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getAuthToken()
  
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

export function loginWithX(): void {
  // For OAuth redirects, we need the actual backend URL, not the proxy path
  // because window.location.href doesn't go through Vite's proxy
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://seedhunterapi.seedplex.io'
  window.location.href = `${backendUrl}${Routes.AUTH_X}`
}

export async function handleCallback(code: string): Promise<{ player: Player; token: string; isNew: boolean }> {
  return api(`${Routes.AUTH_X_CALLBACK}?code=${code}`)
}

export async function logout(): Promise<void> {
  await api(Routes.AUTH_LOGOUT, { method: 'POST' })
  setAuthToken(null)
}

// ============================================
// Players
// ============================================

export async function getPlayer(handle: string): Promise<Player & { stats: { trades: number; points: number; rank: number } }> {
  return api(Routes.PLAYER(handle))
}

export async function getPlayerCard(handle: string): Promise<Card> {
  return api(Routes.PLAYER_CARD(handle))
}

export async function getPlayerProject(handle: string): Promise<Founder> {
  return api(Routes.PLAYER_PROJECT(handle))
}

export async function updatePlayerProfile(data: { email?: string | null }): Promise<Player & { stats: { trades: number; points: number; rank: number } }> {
  return api(Routes.PLAYER_UPDATE, {
    method: 'PATCH',
    body: JSON.stringify(data)
  })
}

export async function getLeaderboard(limit = 50, offset = 0): Promise<PaginatedResponse<LeaderboardEntry>> {
  return api(`${Routes.LEADERBOARD}?limit=${limit}&offset=${offset}`)
}

// ============================================
// Trading
// ============================================

export async function initTrade(location: GeoLocation): Promise<{ payload: string; expiresAt: number }> {
  console.log('initTrade called with location:', location)
  console.log('Auth token present:', !!getAuthToken())
  
  return api(Routes.TRADE_INIT, { 
    method: 'POST',
    body: JSON.stringify({ location }),
  })
}

export async function confirmTrade(payload: string, location: GeoLocation): Promise<{ success: boolean; trade?: Trade; newProject?: Founder; error?: string }> {
  return api(Routes.TRADE_CONFIRM, {
    method: 'POST',
    body: JSON.stringify({ payload, location }),
  })
}

export async function getTradeHistory(): Promise<Trade[]> {
  const result = await api<{ trades: Trade[] }>(Routes.TRADE_HISTORY)
  return result.trades
}

// ============================================
// Map
// ============================================

export async function getAdminLocations(): Promise<AdminLocation[]> {
  const result = await api<{ locations: AdminLocation[] }>(Routes.ADMIN_LOCATIONS)
  return result.locations
}

// ============================================
// Chat
// ============================================

import type { ChatMessage } from '@seedhunter/shared'

export async function getChatMessages(limit = 100, before?: string): Promise<ChatMessage[]> {
  let url = `${Routes.CHAT_MESSAGES}?limit=${limit}`
  if (before) {
    url += `&before=${before}`
  }
  const result = await api<{ messages: ChatMessage[] }>(url)
  return result.messages
}

export async function sendChatMessage(content: string): Promise<ChatMessage> {
  const result = await api<{ message: ChatMessage }>(Routes.CHAT_MESSAGES, {
    method: 'POST',
    body: JSON.stringify({ content }),
  })
  return result.message
}

// ============================================
// WebSocket
// ============================================

const WS_BASE = import.meta.env.VITE_WS_URL || 
  (typeof window !== 'undefined' 
    ? window.location.origin.replace(/^http/, 'ws') + '/ws'
    : 'wss://seedhunterapi.seedplex.io/ws')

export type WSMessageHandler = (message: any) => void

let wsConnection: WebSocket | null = null
let wsReconnectAttempts = 0
let wsMessageHandlers: Set<WSMessageHandler> = new Set()

export function connectWebSocket(onMessage?: WSMessageHandler): WebSocket | null {
  if (typeof window === 'undefined') return null
  
  if (wsConnection?.readyState === WebSocket.OPEN) {
    if (onMessage) wsMessageHandlers.add(onMessage)
    return wsConnection
  }
  
  const token = getAuthToken()
  const wsUrl = token ? `${WS_BASE}?token=${encodeURIComponent(token)}` : WS_BASE
  
  try {
    wsConnection = new WebSocket(wsUrl)
    
    wsConnection.onopen = () => {
      console.log('WebSocket connected')
      wsReconnectAttempts = 0
    }
    
    wsConnection.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        wsMessageHandlers.forEach(handler => handler(data))
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }
    
    wsConnection.onclose = () => {
      console.log('WebSocket disconnected')
      wsConnection = null
      
      // Reconnect with exponential backoff
      if (wsReconnectAttempts < 5) {
        const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), 30000)
        wsReconnectAttempts++
        setTimeout(() => connectWebSocket(), delay)
      }
    }
    
    wsConnection.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
    
    if (onMessage) wsMessageHandlers.add(onMessage)
    
    return wsConnection
  } catch (err) {
    console.error('Failed to connect WebSocket:', err)
    return null
  }
}

export function disconnectWebSocket() {
  if (wsConnection) {
    wsConnection.close()
    wsConnection = null
  }
  wsMessageHandlers.clear()
}

export function removeWSHandler(handler: WSMessageHandler) {
  wsMessageHandlers.delete(handler)
}

export function sendWSMessage(message: any): boolean {
  if (wsConnection?.readyState === WebSocket.OPEN) {
    wsConnection.send(JSON.stringify(message))
    return true
  }
  return false
}

// ============================================
// Optional: Nearby Players
// ============================================

export async function updateMyLocation(lat: number, lng: number): Promise<void> {
  // TODO: Implement when player location feature is enabled
}

export async function getNearbyPlayers(radiusMeters: number): Promise<{ xHandle: string; distance: number }[]> {
  // TODO: Implement when player location feature is enabled
  return []
}
