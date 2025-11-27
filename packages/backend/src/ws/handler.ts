import type { ServerWebSocket } from 'bun'
import type { WSClientMessage, WSServerMessage, ChatMessage, Trade, AdminLocation } from '@seedhunter/shared'
import { verifyToken } from '../services/auth'
import { addMessage, validateMessage } from '../services/chat'
import { filterProfanity } from '../utils/profanity'

// Data attached to each WebSocket connection
export interface WSData {
  id: string
  token: string | null
  playerHandle: string | null
  isAdmin: boolean
  channels: Set<string>
}

// Store active connections
const connections = new Map<string, ServerWebSocket<WSData>>()

// Connection count for monitoring
export function getConnectionCount(): number {
  return connections.size
}

// WebSocket message handlers (for Bun.serve websocket option)
export const websocket = {
  async open(ws: ServerWebSocket<WSData>) {
    // Initialize connection data
    ws.data.playerHandle = null
    ws.data.isAdmin = false
    ws.data.channels = new Set(['chat', 'verifications', 'locations']) // Subscribe to these by default
    
    // Store the connection
    connections.set(ws.data.id, ws)
    
    // Authenticate if token provided
    if (ws.data.token) {
      await authenticateConnection(ws)
    }
    
    console.log(`WebSocket connected: ${ws.data.id} (${ws.data.playerHandle || 'anonymous'})`)
    
    // Send welcome message
    send(ws, { type: 'pong' })
  },
  
  async message(ws: ServerWebSocket<WSData>, message: string | Buffer) {
    try {
      const data = JSON.parse(message.toString()) as WSClientMessage | { type: 'auth'; token: string }
      
      switch (data.type) {
        case 'auth' as any:
          // Handle late authentication
          ws.data.token = (data as any).token
          await authenticateConnection(ws)
          send(ws, { type: 'pong' }) // Acknowledge auth
          break
          
        case 'chat':
          await handleChatMessage(ws, data.content)
          break
          
        case 'subscribe':
          data.channels.forEach(ch => ws.data.channels.add(ch))
          break
          
        case 'ping':
          send(ws, { type: 'pong' })
          break
      }
    } catch (err) {
      console.error('WebSocket message error:', err)
      send(ws, { type: 'error', message: 'Invalid message format' })
    }
  },
  
  close(ws: ServerWebSocket<WSData>) {
    connections.delete(ws.data.id)
    console.log(`WebSocket disconnected: ${ws.data.id}`)
  },
  
  error(ws: ServerWebSocket<WSData>, error: Error) {
    console.error(`WebSocket error for ${ws.data.id}:`, error)
  }
}

/**
 * Authenticate a connection using a JWT token
 */
async function authenticateConnection(ws: ServerWebSocket<WSData>): Promise<boolean> {
  try {
    if (!ws.data.token) return false
    
    const payload = await verifyToken(ws.data.token)
    
    if (!payload) {
      return false
    }
    
    if (payload.type === 'player') {
      ws.data.playerHandle = payload.sub
      ws.data.isAdmin = false
    } else if (payload.type === 'admin') {
      ws.data.playerHandle = payload.sub
      ws.data.isAdmin = true
    }
    
    // Subscribe admins to additional channels
    if (ws.data.isAdmin) {
      ws.data.channels.add('admin')
    }
    
    return true
  } catch {
    return false
  }
}

function send(ws: ServerWebSocket<WSData>, message: WSServerMessage) {
  try {
    ws.send(JSON.stringify(message))
  } catch {
    // Connection might be closed
  }
}

async function handleChatMessage(ws: ServerWebSocket<WSData>, content: string) {
  if (!ws.data.playerHandle) {
    send(ws, { type: 'error', message: 'Not authenticated' })
    return
  }
  
  // Validate message
  const validation = validateMessage(ws.data.playerHandle, content)
  if (!validation.valid) {
    send(ws, { type: 'error', message: validation.error || 'Invalid message' })
    return
  }
  
  // Save message to database and get result
  const result = await addMessage(ws.data.playerHandle, content, ws.data.isAdmin)
  
  if ('error' in result) {
    send(ws, { type: 'error', message: result.error })
    return
  }
  
  // Broadcast to all chat subscribers
  broadcast('chat', { type: 'chat', message: result })
}

/**
 * Broadcast a message to all connections subscribed to a channel
 */
export function broadcast(channel: string, message: WSServerMessage) {
  const payload = JSON.stringify(message)
  
  for (const ws of connections.values()) {
    if (ws.data.channels.has(channel)) {
      try {
        ws.send(payload)
      } catch {
        // Connection might be closed, will be cleaned up on close event
      }
    }
  }
}

/**
 * Broadcast chat message deletion
 */
export function broadcastChatDelete(msgId: string) {
  broadcast('chat', { type: 'chat_deleted', msgId })
}

/**
 * Broadcast trade completion
 */
export function broadcastTradeComplete(trade: Trade) {
  broadcast('trades', { type: 'trade_complete', trade })
}

/**
 * Broadcast player verification
 */
export function broadcastPlayerVerified(handle: string) {
  broadcast('verifications', { type: 'player_verified', handle })
}

/**
 * Send a message to a specific player
 */
export function sendToPlayer(handle: string, message: WSServerMessage) {
  const payload = JSON.stringify(message)
  
  for (const ws of connections.values()) {
    if (ws.data.playerHandle === handle) {
      try {
        ws.send(payload)
      } catch {
        // Connection might be closed
      }
    }
  }
}

/**
 * Broadcast a single admin's location update
 */
export function broadcastAdminLocationUpdate(location: AdminLocation) {
  broadcast('locations', { type: 'admin_location_update', location })
}

/**
 * Broadcast all admin locations (e.g., when a new client connects)
 */
export function broadcastAdminLocations(locations: AdminLocation[]) {
  broadcast('locations', { type: 'admin_locations', locations })
}
