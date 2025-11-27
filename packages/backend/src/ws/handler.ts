import type { Context } from 'hono'
import type { WSClientMessage, WSServerMessage, ChatMessage, Trade, AdminLocation } from '@seedhunter/shared'
import { verifyToken } from '../services/auth'
import { addMessage, validateMessage } from '../services/chat'
import { filterProfanity } from '../utils/profanity'

interface Connection {
  ws: WebSocket
  connId: string
  playerHandle: string | null
  isAdmin: boolean
  channels: Set<string>
}

// Store active connections
const connections = new Map<string, Connection>()

// Connection count for monitoring
export function getConnectionCount(): number {
  return connections.size
}

export function wsHandler(c: Context) {
  // Upgrade to WebSocket
  const upgradeHeader = c.req.header('Upgrade')
  
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 426)
  }
  
  // Get token from query string for WebSocket auth
  const token = c.req.query('token')
  
  // Bun's native WebSocket upgrade
  const server = (c.env as any)?.server
  
  if (!server) {
    return c.text('WebSocket not available', 500)
  }
  
  const success = server.upgrade(c.req.raw, {
    data: {
      id: crypto.randomUUID(),
      token: token || null,
      playerHandle: null,
      isAdmin: false,
    }
  })
  
  if (success) {
    return new Response(null, { status: 101 })
  }
  
  return c.text('WebSocket upgrade failed', 500)
}

// WebSocket message handlers (for Bun.serve websocket option)
export const websocket = {
  async open(ws: WebSocket & { data: { id: string; token?: string } }) {
    const connId = ws.data.id
    
    // Create connection with default state
    const conn: Connection = {
      ws,
      connId,
      playerHandle: null,
      isAdmin: false,
      channels: new Set(['chat', 'verifications', 'locations']) // Subscribe to these by default
    }
    
    connections.set(connId, conn)
    
    // Authenticate if token provided
    if (ws.data.token) {
      await authenticateConnection(conn, ws.data.token)
    }
    
    console.log(`WebSocket connected: ${connId} (${conn.playerHandle || 'anonymous'})`)
    
    // Send welcome message
    send(ws, {
      type: 'pong' // Use pong as a simple acknowledgment
    })
  },
  
  async message(ws: WebSocket & { data: { id: string } }, message: string | Buffer) {
    const connId = ws.data.id
    const conn = connections.get(connId)
    
    if (!conn) return
    
    try {
      const data = JSON.parse(message.toString()) as WSClientMessage | { type: 'auth'; token: string }
      
      switch (data.type) {
        case 'auth' as any:
          // Handle late authentication
          await authenticateConnection(conn, (data as any).token)
          send(ws, {
            type: 'pong' // Acknowledge auth
          })
          break
          
        case 'chat':
          await handleChatMessage(conn, data.content)
          break
          
        case 'subscribe':
          data.channels.forEach(ch => conn.channels.add(ch))
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
  
  close(ws: WebSocket & { data: { id: string } }) {
    const connId = ws.data.id
    connections.delete(connId)
    console.log(`WebSocket disconnected: ${connId}`)
  },
  
  error(ws: WebSocket & { data: { id: string } }, error: Error) {
    console.error(`WebSocket error for ${ws.data.id}:`, error)
  }
}

/**
 * Authenticate a connection using a JWT token
 */
async function authenticateConnection(conn: Connection, token: string): Promise<boolean> {
  try {
    const payload = await verifyToken(token)
    
    if (!payload) {
      return false
    }
    
    if (payload.type === 'player') {
      conn.playerHandle = payload.sub
      conn.isAdmin = false
    } else if (payload.type === 'admin') {
      conn.playerHandle = payload.sub
      conn.isAdmin = true
    }
    
    // Subscribe admins to additional channels
    if (conn.isAdmin) {
      conn.channels.add('admin')
    }
    
    return true
  } catch {
    return false
  }
}

function send(ws: WebSocket, message: WSServerMessage) {
  try {
    ws.send(JSON.stringify(message))
  } catch {
    // Connection might be closed
  }
}

async function handleChatMessage(conn: Connection, content: string) {
  if (!conn.playerHandle) {
    send(conn.ws, { type: 'error', message: 'Not authenticated' })
    return
  }
  
  // Validate message
  const validation = validateMessage(conn.playerHandle, content)
  if (!validation.valid) {
    send(conn.ws, { type: 'error', message: validation.error || 'Invalid message' })
    return
  }
  
  // Save message to database and get result
  const result = await addMessage(conn.playerHandle, content, conn.isAdmin)
  
  if ('error' in result) {
    send(conn.ws, { type: 'error', message: result.error })
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
  
  for (const conn of connections.values()) {
    if (conn.channels.has(channel)) {
      try {
        conn.ws.send(payload)
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
  
  for (const conn of connections.values()) {
    if (conn.playerHandle === handle) {
      try {
        conn.ws.send(payload)
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
