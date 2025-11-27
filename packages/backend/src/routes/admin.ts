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
import { requireAdmin } from '../middleware/auth'
import { adminRateLimit, defaultRateLimit } from '../middleware/rateLimit'
import { broadcastPlayerVerified, broadcastChatDelete, broadcastAdminLocationUpdate } from '../ws/handler'
import { getAdminLocation } from '../services/location'

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
