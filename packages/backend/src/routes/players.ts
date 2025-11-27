import { Hono } from 'hono'
import type { Context } from 'hono'
import { LEADERBOARD_DEFAULT_LIMIT, LEADERBOARD_MAX_LIMIT, ErrorCodes } from '@seedhunter/shared'
import {
  getPlayerByHandle,
  getPlayerCard,
  getPlayerStats,
  getLeaderboard,
  updatePlayerLocation,
  getNearbyPlayers
} from '../services/player'
import { optionalAuth, requirePlayer } from '../middleware/auth'
import { defaultRateLimit } from '../middleware/rateLimit'

export const playerRoutes = new Hono()

// Apply default rate limiting
playerRoutes.use('*', defaultRateLimit)

// Get leaderboard
playerRoutes.get('/leaderboard', async (c: Context) => {
  const limit = Math.min(
    parseInt(c.req.query('limit') || String(LEADERBOARD_DEFAULT_LIMIT)),
    LEADERBOARD_MAX_LIMIT
  )
  const offset = Math.max(0, parseInt(c.req.query('offset') || '0'))
  
  try {
    const result = await getLeaderboard(limit, offset)
    
    return c.json({
      items: result.entries,
      total: result.total,
      offset,
      limit
    })
  } catch (error) {
    console.error('Leaderboard error:', error)
    return c.json({
      error: 'Failed to get leaderboard',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Get player by handle
playerRoutes.get('/:handle', async (c: Context) => {
  const handle = c.req.param('handle')
  
  try {
    const player = await getPlayerByHandle(handle)
    
    if (!player) {
      return c.json({
        error: 'Player not found',
        code: ErrorCodes.PLAYER_NOT_FOUND
      }, 404)
    }
    
    const card = await getPlayerCard(handle)
    const stats = await getPlayerStats(handle)
    
    return c.json({
      xHandle: player.xHandle,
      xProfilePic: player.xProfilePic,
      verified: player.verified,
      verifiedAt: player.verifiedAt,
      card,
      stats
    })
  } catch (error) {
    console.error('Get player error:', error)
    return c.json({
      error: 'Failed to get player',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Get player's current card
playerRoutes.get('/:handle/card', async (c: Context) => {
  const handle = c.req.param('handle')
  
  try {
    const card = await getPlayerCard(handle)
    
    if (!card) {
      return c.json({
        error: 'Player or card not found',
        code: ErrorCodes.PLAYER_NOT_FOUND
      }, 404)
    }
    
    return c.json(card)
  } catch (error) {
    console.error('Get card error:', error)
    return c.json({
      error: 'Failed to get card',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Update player location (optional feature)
playerRoutes.post('/location', requirePlayer, async (c: Context) => {
  const player = c.get('player')!
  
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
    
    await updatePlayerLocation(player.id, body.lat, body.lng)
    
    return c.json({ success: true })
  } catch (error) {
    console.error('Update location error:', error)
    return c.json({
      error: 'Failed to update location',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Get nearby players (optional feature)
playerRoutes.get('/nearby', requirePlayer, async (c: Context) => {
  try {
    const lat = parseFloat(c.req.query('lat') || '')
    const lng = parseFloat(c.req.query('lng') || '')
    const radius = parseInt(c.req.query('radius') || '25')
    
    if (isNaN(lat) || isNaN(lng)) {
      return c.json({
        error: 'Latitude and longitude required',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    // Limit radius to reasonable values (5-100 meters)
    const validRadius = Math.max(5, Math.min(100, radius))
    
    const nearby = await getNearbyPlayers(lat, lng, validRadius)
    
    return c.json({ nearby })
  } catch (error) {
    console.error('Nearby players error:', error)
    return c.json({
      error: 'Failed to get nearby players',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})
