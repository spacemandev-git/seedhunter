import type { Context } from 'hono'
import type { WSClientMessage, WSServerMessage, ChatMessage } from '@seedhunter/shared'

interface Connection {
  ws: WebSocket
  playerHandle: string | null
  isAdmin: boolean
  channels: Set<string>
}

// Store active connections
const connections = new Map<string, Connection>()

export function wsHandler(c: Context) {
  // Upgrade to WebSocket
  const upgradeHeader = c.req.header('Upgrade')
  
  if (upgradeHeader !== 'websocket') {
    return c.text('Expected WebSocket upgrade', 426)
  }
  
  // Bun's native WebSocket upgrade
  const server = (c.env as any)?.server
  
  if (!server) {
    return c.text('WebSocket not available', 500)
  }
  
  const success = server.upgrade(c.req.raw, {
    data: {
      id: crypto.randomUUID(),
      playerHandle: null, // Set after auth
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
  open(ws: WebSocket & { data: { id: string } }) {
    const connId = ws.data.id
    connections.set(connId, {
      ws,
      playerHandle: null,
      isAdmin: false,
      channels: new Set(['chat']) // Subscribe to chat by default
    })
    console.log(`WebSocket connected: ${connId}`)
  },
  
  message(ws: WebSocket & { data: { id: string } }, message: string | Buffer) {
    const connId = ws.data.id
    const conn = connections.get(connId)
    
    if (!conn) return
    
    try {
      const data = JSON.parse(message.toString()) as WSClientMessage
      
      switch (data.type) {
        case 'chat':
          handleChatMessage(conn, data.content)
          break
          
        case 'subscribe':
          data.channels.forEach(ch => conn.channels.add(ch))
          break
          
        case 'ping':
          send(ws, { type: 'pong' })
          break
      }
    } catch (err) {
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

function send(ws: WebSocket, message: WSServerMessage) {
  ws.send(JSON.stringify(message))
}

function handleChatMessage(conn: Connection, content: string) {
  if (!conn.playerHandle) {
    send(conn.ws, { type: 'error', message: 'Not authenticated' })
    return
  }
  
  // TODO: Save message to database
  // TODO: Apply profanity filter
  
  const message: ChatMessage = {
    id: crypto.randomUUID(),
    senderHandle: conn.playerHandle,
    content,
    isAdmin: conn.isAdmin,
    createdAt: Date.now()
  }
  
  // Broadcast to all connections subscribed to chat
  broadcast('chat', { type: 'chat', message })
}

export function broadcast(channel: string, message: WSServerMessage) {
  const payload = JSON.stringify(message)
  
  for (const conn of connections.values()) {
    if (conn.channels.has(channel)) {
      try {
        conn.ws.send(payload)
      } catch (err) {
        // Connection might be closed
      }
    }
  }
}

export function broadcastChatDelete(msgId: string) {
  broadcast('chat', { type: 'chat_deleted', msgId })
}

export function broadcastTradeComplete(trade: any) {
  broadcast('trades', { type: 'trade_complete', trade })
}

export function broadcastPlayerVerified(handle: string) {
  broadcast('verifications', { type: 'player_verified', handle })
}
