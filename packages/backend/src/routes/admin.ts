import { Hono } from 'hono'
import type { Context } from 'hono'
import { prisma } from '../db'

export const adminRoutes = new Hono()

// Get all admin locations (public endpoint)
adminRoutes.get('/locations', async (c: Context) => {
  const admins = await prisma.admin.findMany({
    where: {
      locationLat: { not: null },
      locationLng: { not: null }
    },
    select: {
      username: true,
      locationLat: true,
      locationLng: true,
      locationVisible: true,
      locationUpdatedAt: true
    }
  })
  
  return c.json({
    locations: admins.map(admin => ({
      username: admin.username,
      location: admin.locationVisible 
        ? { lat: admin.locationLat, lng: admin.locationLng }
        : '<encrypted>',
      updatedAt: admin.locationUpdatedAt
    }))
  })
})

// Update admin location (admin auth required)
adminRoutes.post('/location', async (c: Context) => {
  // TODO: Verify admin JWT and get admin ID
  // const adminId = c.get('adminId')
  
  const body = await c.req.json<{ lat: number; lng: number }>()
  
  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    return c.json({ error: 'Invalid coordinates' }, 400)
  }
  
  // TODO: Use actual admin ID from JWT
  // await prisma.admin.update({
  //   where: { id: adminId },
  //   data: {
  //     locationLat: body.lat,
  //     locationLng: body.lng,
  //     locationUpdatedAt: new Date()
  //   }
  // })
  
  return c.json({ 
    success: true,
    message: 'Location update - implementation pending' 
  })
})

// Toggle admin visibility (admin auth required)
adminRoutes.patch('/visibility', async (c: Context) => {
  // TODO: Verify admin JWT and get admin ID
  // const adminId = c.get('adminId')
  
  const body = await c.req.json<{ visible: boolean }>()
  
  if (typeof body.visible !== 'boolean') {
    return c.json({ error: 'Invalid visibility value' }, 400)
  }
  
  // TODO: Use actual admin ID from JWT
  // await prisma.admin.update({
  //   where: { id: adminId },
  //   data: { locationVisible: body.visible }
  // })
  
  return c.json({ 
    success: true,
    visible: body.visible,
    message: 'Visibility toggle - implementation pending'
  })
})

// Verify a player (admin auth required)
adminRoutes.post('/verify/:handle', async (c: Context) => {
  // TODO: Verify admin JWT
  // const adminId = c.get('adminId')
  
  const handle = c.req.param('handle')
  
  // Check if player exists
  const player = await prisma.player.findUnique({
    where: { xHandle: handle }
  })
  
  if (!player) {
    return c.json({ error: 'Player not found' }, 404)
  }
  
  if (player.verified) {
    return c.json({ error: 'Player already verified' }, 400)
  }
  
  // Verify the player
  const updatedPlayer = await prisma.player.update({
    where: { id: player.id },
    data: {
      verified: true,
      verifiedAt: new Date(),
      // verifiedBy: adminId // TODO: Add when auth is implemented
    }
  })
  
  // Count trades that just became verified (both parties now verified)
  const tradesVerified = await prisma.trade.count({
    where: {
      OR: [
        { playerAId: player.id },
        { playerBId: player.id }
      ],
      playerA: { verified: true },
      playerB: { verified: true }
    }
  })
  
  return c.json({
    success: true,
    player: {
      handle: updatedPlayer.xHandle,
      verified: true,
      verifiedAt: updatedPlayer.verifiedAt
    },
    tradesVerified
  })
})
