// ============================================
// Player Types
// ============================================

export interface Player {
  id: string
  xHandle: string
  xProfilePic: string | null
  cardId: string
  verified: boolean
  verifiedAt: number | null
  createdAt: number
  lastLocationLat: number | null
  lastLocationLng: number | null
  lastLocationAt: number | null
}

export interface PlayerStats {
  trades: number
  points: number
  rank: number
}

export interface PlayerWithStats extends Player {
  stats: PlayerStats
}

export interface LeaderboardEntry {
  rank: number
  xHandle: string
  points: number
  trades: number
  verified: boolean
}

export interface NearbyPlayer {
  xHandle: string
  distance: number // meters
  lastSeenAt: number
}

// ============================================
// Card Types
// ============================================

export interface Card {
  id: string
  founderName: string
  company: string
  role: string
  xHandle: string | null
  category: CardCategory
  imagePath: string
  createdAt: number
}

export type CardCategory =
  | 'tech'
  | 'finance'
  | 'retail'
  | 'media'
  | 'transport'
  | 'food'
  | 'health'
  | 'crypto'
  | 'other'

// ============================================
// Trade Types
// ============================================

export interface Trade {
  id: string
  playerA: string // xHandle
  playerB: string // xHandle
  cardA: string // cardId
  cardB: string // cardId
  timestamp: number
}

export interface TradePayload {
  initiator: string
  cardId: string
  nonce: string
  expiresAt: number
  signature: string
}

export interface TradeResult {
  success: boolean
  trade?: Trade
  newCard?: Card
  error?: string
}

// ============================================
// Admin Types
// ============================================

export interface Admin {
  id: string
  username: string
  locationLat: number | null
  locationLng: number | null
  locationVisible: boolean
  locationUpdatedAt: number | null
  createdAt: number
}

export interface AdminLocation {
  username: string
  location: { lat: number; lng: number } | '<encrypted>'
  updatedAt: number | null
}

export interface AdminSession {
  token: string
  admin: Omit<Admin, 'passwordHash'>
  expiresAt: number
}

// ============================================
// Chat Types
// ============================================

export interface ChatMessage {
  id: string
  senderHandle: string
  content: string
  isAdmin: boolean
  createdAt: number
}

// ============================================
// Auth Types
// ============================================

export interface TokenPayload {
  sub: string // player handle or admin id
  type: 'player' | 'admin'
  iat: number
  exp: number
}

export interface XProfile {
  id: string
  username: string
  name: string
  profile_image_url: string
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  offset: number
  limit: number
}

// ============================================
// WebSocket Message Types
// ============================================

export type WSClientMessage =
  | { type: 'chat'; content: string }
  | { type: 'subscribe'; channels: string[] }
  | { type: 'ping' }

export type WSServerMessage =
  | { type: 'chat'; message: ChatMessage }
  | { type: 'chat_deleted'; msgId: string }
  | { type: 'trade_complete'; trade: Trade }
  | { type: 'player_verified'; handle: string }
  | { type: 'admin_location_update'; location: AdminLocation }
  | { type: 'admin_locations'; locations: AdminLocation[] }
  | { type: 'pong' }
  | { type: 'error'; message: string }
