import { Hono } from 'hono'
import type { Context } from 'hono'
import { ErrorCodes } from '@seedhunter/shared'
import {
  updateAdminLocation,
  setAdminVisibility,
  getAdminLocations,
  clearAdminLocation
} from '../services/location'
import { verifyPlayer } from '../services/player'
import { deleteMessage } from '../services/chat'
import { hashPassword } from '../services/auth'
import { requireAdmin } from '../middleware/auth'
import { adminRateLimit, defaultRateLimit } from '../middleware/rateLimit'
import { broadcastPlayerVerified, broadcastChatDelete, broadcastAdminLocationUpdate } from '../ws/handler'
import { getAdminLocation } from '../services/location'
import { prisma } from '../db'

export const adminRoutes = new Hono()

// Get all admin locations (public endpoint - uses default rate limit)
adminRoutes.get('/locations', defaultRateLimit, async (c: Context) => {
  try {
    const locations = await getAdminLocations()
    return c.json({ locations })
  } catch (error) {
    console.error('Get admin locations error:', error)
    return c.json({
      error: 'Failed to get admin locations',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// All other admin routes require admin auth
adminRoutes.use('*', adminRateLimit)

// Update admin location (admin auth required)
adminRoutes.post('/location', requireAdmin, async (c: Context) => {
  const admin = c.get('admin')!
  
  try {
    const body = await c.req.json<{ lat: number; lng: number }>()
    
    if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
      return c.json({
        error: 'Invalid coordinates',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    // Validate coordinate ranges
    if (body.lat < -90 || body.lat > 90 || body.lng < -180 || body.lng > 180) {
      return c.json({
        error: 'Coordinates out of range',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    await updateAdminLocation(admin.id, body.lat, body.lng)
    
    // Get the updated location and broadcast it
    const updatedLocation = await getAdminLocation(admin.id)
    if (updatedLocation) {
      broadcastAdminLocationUpdate(updatedLocation)
    }
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Update admin location error:', error)
    return c.json({
      error: 'Failed to update location',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Toggle admin visibility (admin auth required)
adminRoutes.patch('/visibility', requireAdmin, async (c: Context) => {
  const admin = c.get('admin')!
  
  try {
    const body = await c.req.json<{ visible: boolean }>()
    
    if (typeof body.visible !== 'boolean') {
      return c.json({
        error: 'Invalid visibility value',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    await setAdminVisibility(admin.id, body.visible)
    
    // Broadcast the updated location (visibility affects what's shown)
    const updatedLocation = await getAdminLocation(admin.id)
    if (updatedLocation) {
      broadcastAdminLocationUpdate(updatedLocation)
    }
    
    return c.json({
      success: true,
      visible: body.visible
    })
  } catch (error) {
    console.error('Update visibility error:', error)
    return c.json({
      error: 'Failed to update visibility',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Clear admin location (stop broadcasting)
adminRoutes.delete('/location', requireAdmin, async (c: Context) => {
  const admin = c.get('admin')!
  
  try {
    await clearAdminLocation(admin.id)
    return c.json({ success: true })
  } catch (error) {
    console.error('Clear location error:', error)
    return c.json({
      error: 'Failed to clear location',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Verify a player (admin auth required)
adminRoutes.post('/verify/:handle', requireAdmin, async (c: Context) => {
  const admin = c.get('admin')!
  const handle = c.req.param('handle')
  
  try {
    const result = await verifyPlayer(handle, admin.id)
    
    if (!result) {
      return c.json({
        error: 'Player not found',
        code: ErrorCodes.PLAYER_NOT_FOUND
      }, 404)
    }
    
    // Check if already verified (tradesVerified will be 0 for already verified)
    if (result.player.verified && result.tradesVerified === 0) {
      // Player was already verified before this call
      const wasAlreadyVerified = result.player.verifiedAt !== null && 
        (Date.now() - result.player.verifiedAt! > 1000) // More than 1 second old
      
      if (wasAlreadyVerified) {
        return c.json({
          error: 'Player already verified',
          code: ErrorCodes.PLAYER_ALREADY_VERIFIED
        }, 400)
      }
    }
    
    // Broadcast verification via WebSocket
    broadcastPlayerVerified(handle)
    
    return c.json({
      success: true,
      player: {
        handle: result.player.xHandle,
        verified: result.player.verified,
        verifiedAt: result.player.verifiedAt
      },
      tradesVerified: result.tradesVerified
    })
  } catch (error) {
    console.error('Verify player error:', error)
    return c.json({
      error: 'Failed to verify player',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Delete a chat message (admin auth required)
adminRoutes.delete('/chat/:msgId', requireAdmin, async (c: Context) => {
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
    broadcastChatDelete(msgId)
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Delete message error:', error)
    return c.json({
      error: 'Failed to delete message',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// ============================================
// Admin Account Management
// ============================================

// List all admin accounts (admin auth required)
adminRoutes.get('/accounts', requireAdmin, async (c: Context) => {
  try {
    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        username: true,
        locationVisible: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' }
    })
    
    return c.json({ admins })
  } catch (error) {
    console.error('List admins error:', error)
    return c.json({
      error: 'Failed to list admins',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Create a new admin account (admin auth required)
adminRoutes.post('/accounts', requireAdmin, async (c: Context) => {
  try {
    const body = await c.req.json<{ username: string; password: string }>()
    
    if (!body.username || !body.password) {
      return c.json({
        error: 'Username and password required',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    // Validate username format
    if (body.username.length < 3 || body.username.length > 32) {
      return c.json({
        error: 'Username must be 3-32 characters',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    if (!/^[a-zA-Z0-9_-]+$/.test(body.username)) {
      return c.json({
        error: 'Username can only contain letters, numbers, underscores, and hyphens',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    // Validate password strength
    if (body.password.length < 8) {
      return c.json({
        error: 'Password must be at least 8 characters',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    // Check if username already exists
    const existing = await prisma.admin.findUnique({
      where: { username: body.username }
    })
    
    if (existing) {
      return c.json({
        error: 'Username already taken',
        code: ErrorCodes.VALIDATION_ERROR
      }, 409)
    }
    
    // Hash password and create admin
    const passwordHash = await hashPassword(body.password)
    
    const admin = await prisma.admin.create({
      data: {
        username: body.username,
        passwordHash,
      },
      select: {
        id: true,
        username: true,
        createdAt: true,
      }
    })
    
    console.log(`Admin account created: ${admin.username}`)
    
    return c.json({
      success: true,
      admin
    }, 201)
  } catch (error) {
    console.error('Create admin error:', error)
    return c.json({
      error: 'Failed to create admin',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Update admin password (admin auth required)
adminRoutes.patch('/accounts/:id', requireAdmin, async (c: Context) => {
  const targetId = c.req.param('id')
  const currentAdmin = c.get('admin')!
  
  try {
    const body = await c.req.json<{ password?: string }>()
    
    // Only allow updating own password or if you're updating another admin
    // (In a real app, you might want super-admin roles)
    
    if (!body.password) {
      return c.json({
        error: 'Password required',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    if (body.password.length < 8) {
      return c.json({
        error: 'Password must be at least 8 characters',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    // Check if target admin exists
    const target = await prisma.admin.findUnique({
      where: { id: targetId }
    })
    
    if (!target) {
      return c.json({
        error: 'Admin not found',
        code: ErrorCodes.VALIDATION_ERROR
      }, 404)
    }
    
    // Hash and update password
    const passwordHash = await hashPassword(body.password)
    
    await prisma.admin.update({
      where: { id: targetId },
      data: { passwordHash }
    })
    
    console.log(`Admin password updated: ${target.username} (by ${currentAdmin.username})`)
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Update admin error:', error)
    return c.json({
      error: 'Failed to update admin',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Delete an admin account (admin auth required)
adminRoutes.delete('/accounts/:id', requireAdmin, async (c: Context) => {
  const targetId = c.req.param('id')
  const currentAdmin = c.get('admin')!
  
  try {
    // Prevent self-deletion
    if (targetId === currentAdmin.id) {
      return c.json({
        error: 'Cannot delete your own account',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    // Check if target exists
    const target = await prisma.admin.findUnique({
      where: { id: targetId }
    })
    
    if (!target) {
      return c.json({
        error: 'Admin not found',
        code: ErrorCodes.VALIDATION_ERROR
      }, 404)
    }
    
    // Ensure at least one admin remains
    const adminCount = await prisma.admin.count()
    if (adminCount <= 1) {
      return c.json({
        error: 'Cannot delete the last admin account',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    await prisma.admin.delete({
      where: { id: targetId }
    })
    
    console.log(`Admin account deleted: ${target.username} (by ${currentAdmin.username})`)
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Delete admin error:', error)
    return c.json({
      error: 'Failed to delete admin',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})
