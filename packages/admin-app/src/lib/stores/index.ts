import type { Admin, ChatMessage } from '@seedhunter/shared'
import { getAuthToken } from '$lib/api/client'

// ============================================
// Auth Store
// ============================================

interface AuthState {
  admin: Admin | null
  token: string | null
  loading: boolean
}

function createAuthStore() {
  let state = $state<AuthState>({
    admin: null,
    token: null,
    loading: true
  })
  
  return {
    get admin() { return state.admin },
    get token() { return state.token },
    get loading() { return state.loading },
    get isLoggedIn() { return state.admin !== null },
    
    async init() {
      try {
        const token = await getAuthToken()
        if (token) {
          // Decode token to get admin info (simplified)
          const payload = JSON.parse(atob(token.split('.')[1]))
          state.token = token
          // TODO: Fetch full admin profile
        }
      } catch (err) {
        console.error('Failed to init auth:', err)
      } finally {
        state.loading = false
      }
    },
    
    setAdmin(admin: Admin, token: string) {
      state.admin = admin
      state.token = token
      state.loading = false
    },
    
    logout() {
      state.admin = null
      state.token = null
    }
  }
}

export const auth = createAuthStore()

// ============================================
// Location Store
// ============================================

interface LocationState {
  broadcasting: boolean
  visible: boolean
  lastLat: number | null
  lastLng: number | null
  lastUpdate: number | null
  error: string | null
}

function createLocationStore() {
  let state = $state<LocationState>({
    broadcasting: false,
    visible: true,
    lastLat: null,
    lastLng: null,
    lastUpdate: null,
    error: null
  })
  
  return {
    get broadcasting() { return state.broadcasting },
    get visible() { return state.visible },
    get lastLat() { return state.lastLat },
    get lastLng() { return state.lastLng },
    get lastUpdate() { return state.lastUpdate },
    get error() { return state.error },
    
    setBroadcasting(value: boolean) {
      state.broadcasting = value
    },
    
    setVisible(value: boolean) {
      state.visible = value
    },
    
    updatePosition(lat: number, lng: number) {
      state.lastLat = lat
      state.lastLng = lng
      state.lastUpdate = Date.now()
      state.error = null
    },
    
    setError(error: string) {
      state.error = error
    }
  }
}

export const location = createLocationStore()

// ============================================
// Verification Store
// ============================================

interface Verification {
  handle: string
  timestamp: number
  tradesVerified: number
}

function createVerificationStore() {
  let verifications = $state<Verification[]>([])
  
  return {
    get verifications() { return verifications },
    get recentCount() { return verifications.length },
    
    addVerification(v: Verification) {
      verifications = [v, ...verifications].slice(0, 50) // Keep last 50
    }
  }
}

export const verifications = createVerificationStore()

// ============================================
// Chat Store
// ============================================

function createChatStore() {
  let messages = $state<ChatMessage[]>([])
  
  return {
    get messages() { return messages },
    
    setMessages(msgs: ChatMessage[]) {
      messages = msgs
    },
    
    removeMessage(msgId: string) {
      messages = messages.filter(m => m.id !== msgId)
    }
  }
}

export const chat = createChatStore()
