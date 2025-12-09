// ============================================
// Player Types
// ============================================

export interface Player {
  id: string
  xHandle: string
  xProfilePic: string | null
  email: string | null
  gridIndex: number | null // Index into The Grid's profileInfos
  artStyle: string | null // Art style variant: 'lowpoly' or 'popart'
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
// Founder Types
// ============================================

export interface Founder {
  id: number
  name: string       // Founder's name (e.g., "Steve Jobs")
  company: string    // Company/Project name (e.g., "Apple")
  description: string // Description of what they did
  founded: number    // Year founded
  valuation: string  // Current valuation status
  artStyle?: string  // Art style variant: 'lowpoly' or 'popart'
}

// ============================================
// Grid Project Types (from The Grid API) - DEPRECATED
// ============================================

export interface GridProject {
  gridIndex: number  // Index in The Grid's profileInfos list
  name: string
  logo: string | null
  tagLine: string | null
  description: string | null
  sector: string | null  // e.g., "Gaming", "DeFi", "Infrastructure"
  type: string | null    // e.g., "Project", "Company"
  websiteUrl: string | null
  xHandle: string | null
}

// Legacy Card type alias for backwards compatibility
export type Card = GridProject
export type CardCategory = string

// ============================================
// Trade Types
// ============================================

export interface Trade {
  id: string
  playerA: string // xHandle
  playerB: string // xHandle
  gridIndexA: number // project index traded by player A
  gridIndexB: number // project index traded by player B
  timestamp: number
}

export interface GeoLocation {
  lat: number
  lng: number
}

export interface TradePayload {
  initiator: string
  gridIndex: number // project index being offered
  nonce: string
  expiresAt: number
  signature: string
}

export interface TradeResult {
  success: boolean
  trade?: Trade
  newProject?: Founder
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
