import { Routes, type Player, type LeaderboardEntry, type Card, type Trade, type AdminLocation, type ApiResponse, type PaginatedResponse } from '@seedhunter/shared'

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
  window.location.href = `${API_BASE}${Routes.AUTH_X}`
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

export async function getLeaderboard(limit = 50, offset = 0): Promise<PaginatedResponse<LeaderboardEntry>> {
  return api(`${Routes.LEADERBOARD}?limit=${limit}&offset=${offset}`)
}

// ============================================
// Trading
// ============================================

export async function initTrade(): Promise<{ payload: string; expiresAt: number }> {
  return api(Routes.TRADE_INIT, { method: 'POST' })
}

export async function confirmTrade(payload: string): Promise<{ success: boolean; trade?: Trade; newCard?: Card; error?: string }> {
  return api(Routes.TRADE_CONFIRM, {
    method: 'POST',
    body: JSON.stringify({ payload }),
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
// Optional: Nearby Players
// ============================================

export async function updateMyLocation(lat: number, lng: number): Promise<void> {
  // TODO: Implement when player location feature is enabled
}

export async function getNearbyPlayers(radiusMeters: number): Promise<{ xHandle: string; distance: number }[]> {
  // TODO: Implement when player location feature is enabled
  return []
}
