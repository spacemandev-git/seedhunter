// ============================================
// API Constants
// ============================================

export const API_VERSION = 'v1'

// Trade settings
export const TRADE_EXPIRY_SECONDS = 60
export const TRADE_NONCE_LENGTH = 32

// Chat settings
export const CHAT_MAX_MESSAGES = 1000
export const CHAT_MESSAGE_MAX_LENGTH = 500
export const CHAT_PRUNE_THRESHOLD = 1100

// Location settings
export const LOCATION_UPDATE_INTERVAL_MS = 30_000
export const LOCATION_STALE_THRESHOLD_MS = 15 * 60 * 1000 // 15 minutes
export const NEARBY_RADIUS_OPTIONS = [5, 25, 50] as const // meters

// Trade proximity settings
export const TRADE_PROXIMITY_METERS = 25 // Players must be within 25 meters to trade

// Leaderboard settings
export const LEADERBOARD_DEFAULT_LIMIT = 50
export const LEADERBOARD_MAX_LIMIT = 100

// ============================================
// Card Categories
// ============================================

export const CATEGORY_COLORS: Record<string, string> = {
  tech: '#4A90D9',
  finance: '#2ECC71',
  retail: '#E74C3C',
  media: '#9B59B6',
  transport: '#F39C12',
  food: '#E67E22',
  health: '#1ABC9C',
  crypto: '#F7931A',
  other: '#7F8C8D',
} as const

export const CATEGORY_LABELS: Record<string, string> = {
  tech: 'Technology',
  finance: 'Finance',
  retail: 'Retail',
  media: 'Media',
  transport: 'Transportation',
  food: 'Food & Beverage',
  health: 'Healthcare',
  crypto: 'Crypto & Web3',
  other: 'Other',
} as const

// ============================================
// Error Codes
// ============================================

export const ErrorCodes = {
  // Auth errors
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Trade errors
  TRADE_EXPIRED: 'TRADE_EXPIRED',
  TRADE_INVALID_SIGNATURE: 'TRADE_INVALID_SIGNATURE',
  TRADE_SELF_TRADE: 'TRADE_SELF_TRADE',
  TRADE_NONCE_USED: 'TRADE_NONCE_USED',
  TRADE_TOO_FAR: 'TRADE_TOO_FAR',
  TRADE_LOCATION_REQUIRED: 'TRADE_LOCATION_REQUIRED',
  
  // Player errors
  PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
  PLAYER_ALREADY_VERIFIED: 'PLAYER_ALREADY_VERIFIED',
  
  // Chat errors
  CHAT_MESSAGE_TOO_LONG: 'CHAT_MESSAGE_TOO_LONG',
  CHAT_RATE_LIMITED: 'CHAT_RATE_LIMITED',
  CHAT_PROFANITY_DETECTED: 'CHAT_PROFANITY_DETECTED',
  
  // General errors
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
} as const

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes]

// ============================================
// API Routes (for type-safe clients)
// ============================================

export const Routes = {
  // Auth
  AUTH_X: '/auth/x',
  AUTH_X_CALLBACK: '/auth/x/callback',
  AUTH_LOGOUT: '/auth/logout',
  AUTH_ADMIN_LOGIN: '/auth/admin/login',
  AUTH_ADMIN_REFRESH: '/auth/admin/refresh',
  
  // Players
  PLAYER: (handle: string) => `/players/${handle}` as const,
  PLAYER_CARD: (handle: string) => `/players/${handle}/card` as const,
  PLAYER_PROJECT: (handle: string) => `/players/${handle}/project` as const,
  LEADERBOARD: '/players/leaderboard',
  
  // Trades
  TRADE_INIT: '/trades/init',
  TRADE_CONFIRM: '/trades/confirm',
  TRADE_HISTORY: '/trades/history',
  
  // Admin
  ADMIN_LOCATION: '/admin/location',
  ADMIN_VISIBILITY: '/admin/visibility',
  ADMIN_VERIFY: (handle: string) => `/admin/verify/${handle}` as const,
  ADMIN_LOCATIONS: '/admin/locations',
  
  // Chat
  CHAT_MESSAGES: '/chat/messages',
  CHAT_DELETE: (msgId: string) => `/chat/${msgId}` as const,
  
  // WebSocket
  WS: '/ws',
} as const
