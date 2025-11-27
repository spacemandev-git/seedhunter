import { Hono } from 'hono'
import type { Context } from 'hono'
import { db, generateId } from '../db'
import { CHAT_MAX_MESSAGES, CHAT_MESSAGE_MAX_LENGTH, CHAT_PRUNE_THRESHOLD } from '@seedhunter/shared'

export const chatRoutes = new Hono()

// Get recent messages
chatRoutes.get('/messages', (c: Context) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), CHAT_MAX_MESSAGES)
  const before = c.req.query('before')
  
  let query = `
    SELECT id, sender_handle, content, is_admin, created_at
    FROM chat_messages
  `
  const params: any[] = []
  
  if (before) {
    query += ` WHERE id < ?`
    params.push(before)
  }
  
  query += ` ORDER BY created_at DESC LIMIT ?`
  params.push(limit)
  
  const messages = db.prepare(query).all(...params)
  
  return c.json({
    messages: (messages as any[]).map(m => ({
      id: m.id,
      senderHandle: m.sender_handle,
      content: m.content,
      isAdmin: Boolean(m.is_admin),
      createdAt: m.created_at
    })).reverse() // Return in chronological order
  })
})

// Send a message
chatRoutes.post('/messages', async (c: Context) => {
  // TODO: Get user from JWT (player or admin)
  // const user = c.get('user')
  
  const body = await c.req.json<{ content: string }>()
  
  if (!body.content || typeof body.content !== 'string') {
    return c.json({ error: 'Message content required' }, 400)
  }
  
  if (body.content.length > CHAT_MESSAGE_MAX_LENGTH) {
    return c.json({ error: `Message too long (max ${CHAT_MESSAGE_MAX_LENGTH} chars)` }, 400)
  }
  
  // TODO: Apply profanity filter
  const filteredContent = body.content // filterProfanity(body.content)
  
  const id = generateId()
  const now = Date.now()
  
  // TODO: Get actual sender info from JWT
  const senderHandle = 'TODO_USER'
  const isAdmin = false
  
  db.prepare(`
    INSERT INTO chat_messages (id, sender_handle, content, is_admin, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, senderHandle, filteredContent, isAdmin ? 1 : 0, now)
  
  // Prune old messages if needed
  const count = db.prepare('SELECT COUNT(*) as count FROM chat_messages').get() as { count: number }
  if (count.count > CHAT_PRUNE_THRESHOLD) {
    db.prepare(`
      DELETE FROM chat_messages 
      WHERE id IN (
        SELECT id FROM chat_messages 
        ORDER BY created_at ASC 
        LIMIT ?
      )
    `).run(count.count - CHAT_MAX_MESSAGES)
  }
  
  // TODO: Broadcast via WebSocket
  
  return c.json({
    message: {
      id,
      senderHandle,
      content: filteredContent,
      isAdmin,
      createdAt: now
    }
  }, 201)
})

// Delete a message (admin only)
chatRoutes.delete('/:msgId', async (c: Context) => {
  // TODO: Verify admin JWT
  
  const msgId = c.req.param('msgId')
  
  const result = db.prepare('DELETE FROM chat_messages WHERE id = ?').run(msgId)
  
  if (result.changes === 0) {
    return c.json({ error: 'Message not found' }, 404)
  }
  
  // TODO: Broadcast deletion via WebSocket
  
  return c.json({ success: true })
})
