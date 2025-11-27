import { Hono } from 'hono'
import type { Context } from 'hono'
import { prisma } from '../db'
import { CHAT_MAX_MESSAGES, CHAT_MESSAGE_MAX_LENGTH, CHAT_PRUNE_THRESHOLD } from '@seedhunter/shared'

export const chatRoutes = new Hono()

// Get recent messages
chatRoutes.get('/messages', async (c: Context) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '100'), CHAT_MAX_MESSAGES)
  const before = c.req.query('before')
  
  const messages = await prisma.chatMessage.findMany({
    where: before ? {
      createdAt: {
        lt: new Date(before)
      }
    } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      sender: {
        select: { xHandle: true }
      }
    }
  })
  
  return c.json({
    messages: messages.reverse().map(m => ({
      id: m.id,
      senderHandle: m.sender.xHandle,
      content: m.content,
      isAdmin: m.isAdmin,
      createdAt: m.createdAt
    }))
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
  
  // TODO: Get actual sender info from JWT
  // For now, return pending message
  return c.json({ 
    message: 'Chat message creation - implementation pending (requires auth)'
  }, 501)
  
  // Implementation when auth is ready:
  // const message = await prisma.chatMessage.create({
  //   data: {
  //     senderId: user.id,
  //     content: filteredContent,
  //     isAdmin: user.isAdmin || false
  //   },
  //   include: {
  //     sender: { select: { xHandle: true } }
  //   }
  // })
  
  // // Prune old messages if needed
  // const count = await prisma.chatMessage.count()
  // if (count > CHAT_PRUNE_THRESHOLD) {
  //   const oldMessages = await prisma.chatMessage.findMany({
  //     orderBy: { createdAt: 'asc' },
  //     take: count - CHAT_MAX_MESSAGES,
  //     select: { id: true }
  //   })
  //   await prisma.chatMessage.deleteMany({
  //     where: { id: { in: oldMessages.map(m => m.id) } }
  //   })
  // }
  
  // // TODO: Broadcast via WebSocket
  
  // return c.json({
  //   message: {
  //     id: message.id,
  //     senderHandle: message.sender.xHandle,
  //     content: message.content,
  //     isAdmin: message.isAdmin,
  //     createdAt: message.createdAt
  //   }
  // }, 201)
})

// Delete a message (admin only)
chatRoutes.delete('/:msgId', async (c: Context) => {
  // TODO: Verify admin JWT
  
  const msgId = c.req.param('msgId')
  
  try {
    await prisma.chatMessage.delete({
      where: { id: msgId }
    })
    
    // TODO: Broadcast deletion via WebSocket
    
    return c.json({ success: true })
  } catch (error) {
    return c.json({ error: 'Message not found' }, 404)
  }
})
