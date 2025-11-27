import { prisma } from '../db'
import type { ChatMessage } from '@seedhunter/shared'
import { CHAT_MAX_MESSAGES, CHAT_PRUNE_THRESHOLD, CHAT_MESSAGE_MAX_LENGTH } from '@seedhunter/shared'
import { filterProfanity, containsProfanity } from '../utils/profanity'

// ============================================
// Message Management
// ============================================

/**
 * Add a new chat message
 */
export async function addMessage(
  senderHandle: string,
  content: string,
  isAdmin: boolean = false
): Promise<ChatMessage | { error: string }> {
  // Validate content length
  if (content.length > CHAT_MESSAGE_MAX_LENGTH) {
    return { error: `Message too long (max ${CHAT_MESSAGE_MAX_LENGTH} chars)` }
  }
  
  // Get sender player
  const sender = await prisma.player.findUnique({
    where: { xHandle: senderHandle }
  })
  
  if (!sender) {
    return { error: 'Sender not found' }
  }
  
  // Filter profanity (unless admin)
  const filteredContent = isAdmin ? content : filterProfanity(content)
  
  // Create message
  const message = await prisma.chatMessage.create({
    data: {
      senderId: sender.id,
      content: filteredContent,
      isAdmin
    },
    include: {
      sender: { select: { xHandle: true } }
    }
  })
  
  // Prune old messages if needed
  await pruneOldMessages()
  
  return {
    id: message.id,
    senderHandle: message.sender.xHandle,
    content: message.content,
    isAdmin: message.isAdmin,
    createdAt: message.createdAt.getTime()
  }
}

/**
 * Get recent messages
 */
export async function getMessages(
  limit: number = 100,
  before?: string
): Promise<ChatMessage[]> {
  // Get cursor message if provided
  let cursorDate: Date | undefined
  if (before) {
    const cursorMessage = await prisma.chatMessage.findUnique({
      where: { id: before },
      select: { createdAt: true }
    })
    cursorDate = cursorMessage?.createdAt
  }
  
  const messages = await prisma.chatMessage.findMany({
    where: cursorDate ? {
      createdAt: { lt: cursorDate }
    } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      sender: { select: { xHandle: true } }
    }
  })
  
  // Return in chronological order
  return messages.reverse().map(m => ({
    id: m.id,
    senderHandle: m.sender.xHandle,
    content: m.content,
    isAdmin: m.isAdmin,
    createdAt: m.createdAt.getTime()
  }))
}

/**
 * Delete a message (admin only)
 */
export async function deleteMessage(msgId: string): Promise<boolean> {
  try {
    await prisma.chatMessage.delete({
      where: { id: msgId }
    })
    return true
  } catch {
    return false
  }
}

/**
 * Prune old messages to keep under limit
 */
export async function pruneOldMessages(): Promise<number> {
  const count = await prisma.chatMessage.count()
  
  if (count <= CHAT_PRUNE_THRESHOLD) {
    return 0
  }
  
  // Get IDs of messages to delete (oldest ones over the limit)
  const messagesToDelete = await prisma.chatMessage.findMany({
    orderBy: { createdAt: 'asc' },
    take: count - CHAT_MAX_MESSAGES,
    select: { id: true }
  })
  
  const result = await prisma.chatMessage.deleteMany({
    where: {
      id: { in: messagesToDelete.map(m => m.id) }
    }
  })
  
  return result.count
}

// ============================================
// Spam Detection
// ============================================

// Track recent messages for spam detection
const recentMessages = new Map<string, { count: number; lastMessage: string; lastTime: number }>()

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now()
  const threshold = 60 * 1000 // 1 minute
  
  for (const [handle, data] of recentMessages.entries()) {
    if (now - data.lastTime > threshold) {
      recentMessages.delete(handle)
    }
  }
}, 30 * 1000)

/**
 * Check if a message is spam
 */
export function isSpam(handle: string, content: string): boolean {
  const now = Date.now()
  const entry = recentMessages.get(handle)
  
  if (!entry) {
    // First message from this user in window
    recentMessages.set(handle, {
      count: 1,
      lastMessage: content,
      lastTime: now
    })
    return false
  }
  
  // Reset if window expired
  if (now - entry.lastTime > 60 * 1000) {
    recentMessages.set(handle, {
      count: 1,
      lastMessage: content,
      lastTime: now
    })
    return false
  }
  
  // Update entry
  entry.count++
  entry.lastTime = now
  
  // Check for spam conditions
  
  // Too many messages in window
  if (entry.count > 10) {
    return true
  }
  
  // Duplicate message
  if (entry.lastMessage === content && entry.count > 2) {
    return true
  }
  
  entry.lastMessage = content
  return false
}

/**
 * Check if content is likely spam based on patterns
 */
export function isSpamContent(content: string): boolean {
  // Too many caps
  const capsRatio = (content.match(/[A-Z]/g)?.length || 0) / content.length
  if (content.length > 10 && capsRatio > 0.7) {
    return true
  }
  
  // Repeated characters
  if (/(.)\1{10,}/.test(content)) {
    return true
  }
  
  // Common spam patterns
  const spamPatterns = [
    /check\s+my\s+bio/i,
    /follow\s+for\s+follow/i,
    /free\s+(crypto|btc|eth|money)/i,
    /click\s+(here|link|now)/i,
    /www\.|http:|https:/i, // No links in chat
  ]
  
  for (const pattern of spamPatterns) {
    if (pattern.test(content)) {
      return true
    }
  }
  
  return false
}

/**
 * Validate message before sending
 */
export function validateMessage(
  handle: string,
  content: string
): { valid: boolean; error?: string } {
  // Check length
  if (content.length === 0) {
    return { valid: false, error: 'Message cannot be empty' }
  }
  
  if (content.length > CHAT_MESSAGE_MAX_LENGTH) {
    return { valid: false, error: `Message too long (max ${CHAT_MESSAGE_MAX_LENGTH} chars)` }
  }
  
  // Check spam
  if (isSpam(handle, content)) {
    return { valid: false, error: 'Please slow down, you\'re sending too many messages' }
  }
  
  if (isSpamContent(content)) {
    return { valid: false, error: 'Message appears to be spam' }
  }
  
  // Check profanity (warn but don't reject)
  // The message will be filtered instead
  
  return { valid: true }
}
