import { Hono } from 'hono'
import type { Context } from 'hono'
import { db } from '../db'

export const adminRoutes = new Hono()

// Get all admin locations (public endpoint)
adminRoutes.get('/locations', (c: Context) => {
  const admins = db.prepare(`
    SELECT 
      username,
      location_lat,
      location_lng,
      location_visible,
      location_updated_at
    FROM admins
    WHERE location_lat IS NOT NULL AND location_lng IS NOT NULL
  `).all()
  
  return c.json({
    locations: (admins as any[]).map(admin => ({
      username: admin.username,
      location: admin.location_visible 
        ? { lat: admin.location_lat, lng: admin.location_lng }
        : '<encrypted>',
      updatedAt: admin.location_updated_at
    }))
  })
})

// Update admin location (admin auth required)
adminRoutes.post('/location', async (c: Context) => {
  // TODO: Verify admin JWT
  // const admin = c.get('admin')
  
  const body = await c.req.json<{ lat: number; lng: number }>()
  
  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return c.json({ error: 'Invalid coordinates' }, 400)
  }
  
  // TODO: Update admin location in database
  // db.prepare(`
  //   UPDATE admins 
  //   SET location_lat = ?, location_lng = ?, location_updated_at = ?
  //   WHERE id = ?
  // `).run(body.lat, body.lng, Date.now(), admin.id)
  
  return c.json({ 
    success: true,
    message: 'Location update - implementation pending' 
  })
})

// Toggle admin visibility (admin auth required)
adminRoutes.patch('/visibility', async (c: Context) => {
  // TODO: Verify admin JWT
  
  const body = await c.req.json<{ visible: boolean }>()
  
  if (typeof body.visible !== 'boolean') {
    return c.json({ error: 'Invalid visibility value' }, 400)
  }
  
  // TODO: Update visibility in database
  
  return c.json({ 
    success: true,
    visible: body.visible,
    message: 'Visibility toggle - implementation pending'
  })
})

// Verify a player (admin auth required)
adminRoutes.post('/verify/:handle', async (c: Context) => {
  // TODO: Verify admin JWT
  
  const handle = c.req.param('handle')
  
  // Check if player exists
  const player = db.prepare(`
    SELECT id, x_handle, verified FROM players WHERE x_handle = ?
  `).get(handle) as { id: string; x_handle: string; verified: number } | undefined
  
  if (!player) {
    return c.json({ error: 'Player not found' }, 404)
  }
  
  if (player.verified) {
    return c.json({ error: 'Player already verified' }, 400)
  }
  
  // Verify the player
  db.prepare(`
    UPDATE players SET verified = 1, verified_at = ? WHERE id = ?
  `).run(Date.now(), player.id)
  
  // Count trades that just became verified
  const tradesVerified = db.prepare(`
    SELECT COUNT(*) as count FROM trades t
    JOIN players p1 ON t.player_a = p1.x_handle
    JOIN players p2 ON t.player_b = p2.x_handle
    WHERE (t.player_a = ? OR t.player_b = ?)
      AND p1.verified = 1 
      AND p2.verified = 1
  `).get(handle, handle) as { count: number }
  
  return c.json({
    success: true,
    player: {
      handle: player.x_handle,
      verified: true,
      verifiedAt: Date.now()
    },
    tradesVerified: tradesVerified.count
  })
})
