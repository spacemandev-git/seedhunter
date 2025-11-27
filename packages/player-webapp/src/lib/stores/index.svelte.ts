import { getAuthToken, getPlayer, getLeaderboard, logout as apiLogout, setAuthToken, disconnectWebSocket } from '$lib/api/client'
import type { Player, LeaderboardEntry, Card, Trade, AdminLocation, ChatMessage } from '@seedhunter/shared'

// ============================================
// Auth Store
// ============================================

interface AuthState {
  player: (Player & { stats: { trades: number; points: number; rank: number } }) | null
  loading: boolean
  error: string | null
}

function createAuthStore() {
  let state = $state<AuthState>({
    player: null,
    loading: true,
    error: null
  })
  
  return {
    get player() { return state.player },
    get loading() { return state.loading },
    get error() { return state.error },
    get isLoggedIn() { return state.player !== null },
    
    async init() {
      const token = getAuthToken()
      if (!token) {
        state.loading = false
        return
      }
      
      try {
        // Decode handle from token (simplified - should verify properly)
        const payload = JSON.parse(atob(token.split('.')[1]))
        const player = await getPlayer(payload.sub)
        state.player = player
      } catch (err) {
        state.error = err instanceof Error ? err.message : 'Failed to load profile'
      } finally {
        state.loading = false
      }
    },
    
    setPlayer(player: AuthState['player']) {
      state.player = player
      state.loading = false
    },
    
    async logout() {
      try {
        await apiLogout()
      } catch (err) {
        // Even if API call fails, clear local state
        console.error('Logout API error:', err)
      }
      disconnectWebSocket()
      setAuthToken(null)
      state.player = null
    }
  }
}

export const auth = createAuthStore()

// ============================================
// Leaderboard Store
// ============================================

function createLeaderboardStore() {
  let entries = $state<LeaderboardEntry[]>([])
  let total = $state(0)
  let loading = $state(false)
  let error = $state<string | null>(null)
  
  return {
    get entries() { return entries },
    get total() { return total },
    get loading() { return loading },
    get error() { return error },
    
    async fetch(limit = 50, offset = 0) {
      loading = true
      error = null
      
      try {
        const result = await getLeaderboard(limit, offset)
        entries = result.items
        total = result.total
      } catch (err) {
        error = err instanceof Error ? err.message : 'Failed to load leaderboard'
      } finally {
        loading = false
      }
    }
  }
}

export const leaderboard = createLeaderboardStore()

// ============================================
// Trade Store
// ============================================

function createTradeStore() {
  let trades = $state<Trade[]>([])
  let loading = $state(false)
  
  return {
    get trades() { return trades },
    get loading() { return loading },
    
    addTrade(trade: Trade) {
      trades = [trade, ...trades]
    },
    
    setTrades(newTrades: Trade[]) {
      trades = newTrades
    }
  }
}

export const tradeStore = createTradeStore()

// ============================================
// Admin Locations Store
// ============================================

function createAdminLocationsStore() {
  let locations = $state<AdminLocation[]>([])
  let loading = $state(false)
  let lastUpdate = $state<number | null>(null)
  
  return {
    get locations() { return locations },
    get loading() { return loading },
    get lastUpdate() { return lastUpdate },
    
    setLocations(newLocations: AdminLocation[]) {
      locations = newLocations
      lastUpdate = Date.now()
    },
    
    setLoading(isLoading: boolean) {
      loading = isLoading
    }
  }
}

export const adminLocations = createAdminLocationsStore()

// ============================================
// Chat Store (Optional)
// ============================================

function createChatStore() {
  let messages = $state<ChatMessage[]>([])
  let connected = $state(false)
  
  return {
    get messages() { return messages },
    get connected() { return connected },
    
    addMessage(message: ChatMessage) {
      messages = [...messages, message]
      // Keep last 100 messages in memory
      if (messages.length > 100) {
        messages = messages.slice(-100)
      }
    },
    
    removeMessage(msgId: string) {
      messages = messages.filter(m => m.id !== msgId)
    },
    
    setMessages(newMessages: ChatMessage[]) {
      messages = newMessages
    },
    
    setConnected(isConnected: boolean) {
      connected = isConnected
    }
  }
}

export const chat = createChatStore()
