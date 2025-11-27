import { createMiddleware } from 'hono/factory'
import type { Context, Next } from 'hono'
import { ErrorCodes } from '@seedhunter/shared'

interface RateLimitConfig {
  windowMs: number  // Time window in milliseconds
  max: number       // Max requests per window
  keyGenerator?: (c: Context) => string  // Custom key generator
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

// In-memory store for rate limiting
// In production, consider using Redis for distributed systems
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically (every minute)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key)
    }
  }
}, 60 * 1000)

/**
 * Create a rate limiter middleware with specified config
 */
export function rateLimit(config: RateLimitConfig) {
  const { windowMs, max, keyGenerator } = config
  
  return createMiddleware(async (c: Context, next: Next) => {
    // Generate key for this request (default: IP + path)
    const key = keyGenerator
      ? keyGenerator(c)
      : `${c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'}:${c.req.path}`
    
    const now = Date.now()
    let entry = rateLimitStore.get(key)
    
    // Reset if window has passed
    if (!entry || entry.resetAt < now) {
      entry = {
        count: 0,
        resetAt: now + windowMs
      }
    }
    
    entry.count++
    rateLimitStore.set(key, entry)
    
    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(max))
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)))
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)))
    
    // Check if over limit
    if (entry.count > max) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)))
      return c.json({
        error: 'Too many requests, please try again later',
        code: ErrorCodes.RATE_LIMITED,
        retryAfter: Math.ceil((entry.resetAt - now) / 1000)
      }, 429)
    }
    
    return next()
  })
}

// Pre-configured rate limiters for different endpoint types
export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,              // 10 requests per minute
  keyGenerator: (c) => {
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    return `auth:${ip}`
  }
})

export const tradeRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 30,              // 30 requests per minute
  keyGenerator: (c) => {
    const player = c.get('player')
    if (player) {
      return `trade:${player.xHandle}`
    }
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    return `trade:${ip}`
  }
})

export const chatRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 60,              // 60 requests per minute
  keyGenerator: (c) => {
    const player = c.get('player')
    const admin = c.get('admin')
    const userId = player?.xHandle || admin?.username
    if (userId) {
      return `chat:${userId}`
    }
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    return `chat:${ip}`
  }
})

export const adminRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,             // 100 requests per minute
  keyGenerator: (c) => {
    const admin = c.get('admin')
    if (admin) {
      return `admin:${admin.username}`
    }
    const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'
    return `admin:${ip}`
  }
})

export const defaultRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 120,             // 120 requests per minute
})
