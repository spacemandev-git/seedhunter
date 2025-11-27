import { createMiddleware } from 'hono/factory'
import type { Context, Next } from 'hono'
import { verifyToken, getAdminById } from '../services/auth'
import { prisma } from '../db'
import { ErrorCodes } from '@seedhunter/shared'

// Extend Hono context with our custom variables
declare module 'hono' {
  interface ContextVariableMap {
    player: {
      id: string
      xHandle: string
      verified: boolean
    } | null
    admin: {
      id: string
      username: string
    } | null
    tokenPayload: {
      sub: string
      type: 'player' | 'admin'
    } | null
  }
}

/**
 * Extract Bearer token from Authorization header
 */
function extractToken(c: Context): string | null {
  const authHeader = c.req.header('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  return authHeader.slice(7)
}

/**
 * Optional auth middleware - sets player/admin if token is valid, but doesn't require it
 */
export const optionalAuth = createMiddleware(async (c: Context, next: Next) => {
  c.set('player', null)
  c.set('admin', null)
  c.set('tokenPayload', null)
  
  const token = extractToken(c)
  if (!token) {
    return next()
  }
  
  const payload = await verifyToken(token)
  if (!payload) {
    return next()
  }
  
  c.set('tokenPayload', { sub: payload.sub, type: payload.type })
  
  if (payload.type === 'player') {
    const player = await prisma.player.findUnique({
      where: { xHandle: payload.sub },
      select: { id: true, xHandle: true, verified: true }
    })
    
    if (player) {
      c.set('player', player)
    }
  } else if (payload.type === 'admin') {
    const admin = await getAdminById(payload.sub)
    if (admin) {
      c.set('admin', { id: admin.id, username: admin.username })
    }
  }
  
  return next()
})

/**
 * Require authentication - rejects if no valid token
 */
export const requireAuth = createMiddleware(async (c: Context, next: Next) => {
  c.set('player', null)
  c.set('admin', null)
  c.set('tokenPayload', null)
  
  const token = extractToken(c)
  if (!token) {
    return c.json({
      error: 'Authentication required',
      code: ErrorCodes.UNAUTHORIZED
    }, 401)
  }
  
  const payload = await verifyToken(token)
  if (!payload) {
    return c.json({
      error: 'Invalid or expired token',
      code: ErrorCodes.TOKEN_EXPIRED
    }, 401)
  }
  
  c.set('tokenPayload', { sub: payload.sub, type: payload.type })
  
  if (payload.type === 'player') {
    const player = await prisma.player.findUnique({
      where: { xHandle: payload.sub },
      select: { id: true, xHandle: true, verified: true }
    })
    
    if (!player) {
      return c.json({
        error: 'Player not found',
        code: ErrorCodes.PLAYER_NOT_FOUND
      }, 401)
    }
    
    c.set('player', player)
  } else if (payload.type === 'admin') {
    const admin = await getAdminById(payload.sub)
    if (!admin) {
      return c.json({
        error: 'Admin not found',
        code: ErrorCodes.UNAUTHORIZED
      }, 401)
    }
    c.set('admin', { id: admin.id, username: admin.username })
  }
  
  return next()
})

/**
 * Require player authentication specifically
 */
export const requirePlayer = createMiddleware(async (c: Context, next: Next) => {
  c.set('player', null)
  c.set('admin', null)
  c.set('tokenPayload', null)
  
  const token = extractToken(c)
  if (!token) {
    return c.json({
      error: 'Authentication required',
      code: ErrorCodes.UNAUTHORIZED
    }, 401)
  }
  
  const payload = await verifyToken(token)
  if (!payload) {
    return c.json({
      error: 'Invalid or expired token',
      code: ErrorCodes.TOKEN_EXPIRED
    }, 401)
  }
  
  if (payload.type !== 'player') {
    return c.json({
      error: 'Player authentication required',
      code: ErrorCodes.UNAUTHORIZED
    }, 403)
  }
  
  const player = await prisma.player.findUnique({
    where: { xHandle: payload.sub },
    select: { id: true, xHandle: true, verified: true }
  })
  
  if (!player) {
    return c.json({
      error: 'Player not found',
      code: ErrorCodes.PLAYER_NOT_FOUND
    }, 401)
  }
  
  c.set('player', player)
  c.set('tokenPayload', { sub: payload.sub, type: payload.type })
  
  return next()
})

/**
 * Require admin authentication specifically
 */
export const requireAdmin = createMiddleware(async (c: Context, next: Next) => {
  c.set('player', null)
  c.set('admin', null)
  c.set('tokenPayload', null)
  
  const token = extractToken(c)
  if (!token) {
    return c.json({
      error: 'Admin authentication required',
      code: ErrorCodes.UNAUTHORIZED
    }, 401)
  }
  
  const payload = await verifyToken(token)
  if (!payload) {
    return c.json({
      error: 'Invalid or expired token',
      code: ErrorCodes.TOKEN_EXPIRED
    }, 401)
  }
  
  if (payload.type !== 'admin') {
    return c.json({
      error: 'Admin privileges required',
      code: ErrorCodes.UNAUTHORIZED
    }, 403)
  }
  
  const admin = await getAdminById(payload.sub)
  if (!admin) {
    return c.json({
      error: 'Admin not found',
      code: ErrorCodes.UNAUTHORIZED
    }, 401)
  }
  
  c.set('admin', { id: admin.id, username: admin.username })
  c.set('tokenPayload', { sub: payload.sub, type: payload.type })
  
  return next()
})
