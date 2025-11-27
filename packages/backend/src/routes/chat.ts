import { Hono } from 'hono'
import type { Context } from 'hono'
import { CHAT_MAX_MESSAGES, ErrorCodes } from '@seedhunter/shared'
import {
  addMessage,
  getMessages,
  deleteMessage,
  validateMessage
} from '../services/chat'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { chatRateLimit } from '../middleware/rateLimit'
import { broadcast } from '../ws/handler'

export const chatRoutes = new Hono()

// Apply rate limiting to all chat routes
chatRoutes.use('*', chatRateLimit)

// Get recent messages (public, no auth required)
chatRoutes.get('/messages', async (c: Context) => {
  try {
    const limit = Math.min(
      parseInt(c.req.query('limit') || '100'),
      CHAT_MAX_MESSAGES
    )
    const before = c.req.query('before')
    
    const messages = await getMessages(limit, before)
    
    return c.json({ messages })
  } catch (error) {
    console.error('Get messages error:', error)
    return c.json({
      error: 'Failed to get messages',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Send a message (auth required)
chatRoutes.post('/messages', requireAuth, async (c: Context) => {
  const player = c.get('player')
  const admin = c.get('admin')
  
  // Must be either a player or admin
  if (!player && !admin) {
    return c.json({
      error: 'Authentication required',
      code: ErrorCodes.UNAUTHORIZED
    }, 401)
  }
  
  try {
    const body = await c.req.json<{ content: string }>()
    
    if (!body.content || typeof body.content !== 'string') {
      return c.json({
        error: 'Message content required',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    // Get sender handle (player or admin)
    const senderHandle = player?.xHandle || admin?.username
    
    if (!senderHandle) {
      return c.json({
        error: 'Could not determine sender',
        code: ErrorCodes.INTERNAL_ERROR
      }, 500)
    }
    
    // Validate message (spam check, etc.)
    const validation = validateMessage(senderHandle, body.content)
    if (!validation.valid) {
      return c.json({
        error: validation.error || 'Invalid message',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    // Add message (profanity filtered unless admin)
    const isAdmin = !!admin
    const result = await addMessage(senderHandle, body.content, isAdmin)
    
    if ('error' in result) {
      return c.json({
        error: result.error,
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    // Broadcast via WebSocket
    broadcast('chat', {
      type: 'chat',
      message: result
    })
    
    return c.json({ message: result }, 201)
  } catch (error) {
    console.error('Send message error:', error)
    return c.json({
      error: 'Failed to send message',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Delete a message (admin only)
chatRoutes.delete('/:msgId', requireAdmin, async (c: Context) => {
  const msgId = c.req.param('msgId')
  
  try {
    const deleted = await deleteMessage(msgId)
    
    if (!deleted) {
      return c.json({
        error: 'Message not found',
        code: ErrorCodes.VALIDATION_ERROR
      }, 404)
    }
    
    // Broadcast deletion via WebSocket
    broadcast('chat', {
      type: 'chat_deleted',
      msgId
    })
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Delete message error:', error)
    return c.json({
      error: 'Failed to delete message',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})
