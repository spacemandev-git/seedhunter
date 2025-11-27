import { Hono } from 'hono'
import type { Context } from 'hono'
import { prisma } from '../db'
import { LEADERBOARD_DEFAULT_LIMIT, LEADERBOARD_MAX_LIMIT } from '@seedhunter/shared'

export const playerRoutes = new Hono()

// Get player by handle
playerRoutes.get('/:handle', async (c: Context) => {
  const handle = c.req.param('handle')
  
  const player = await prisma.player.findUnique({
    where: { xHandle: handle },
    include: { card: true }
  })
  
  if (!player) {
    return c.json({ error: 'Player not found' }, 404)
  }
  
  // Calculate stats
  const tradeCount = await prisma.trade.count({
    where: {
      OR: [
        { playerAId: player.id },
        { playerBId: player.id }
      ]
    }
  })
  
  // Points = unique verified trades (both parties verified)
  const verifiedTrades = await prisma.trade.findMany({
    where: {
      OR: [
        { playerAId: player.id },
        { playerBId: player.id }
      ],
      playerA: { verified: true },
      playerB: { verified: true }
    },
    select: {
      playerAId: true,
      playerBId: true
    }
  })
  
  // Count unique trading partners from verified trades
  const uniquePartners = new Set(
    verifiedTrades.map(t => 
      t.playerAId === player.id ? t.playerBId : t.playerAId
    )
  )
  const points = uniquePartners.size
  
  // Get rank (count players with more points)
  // This is a simplified version - for production, consider caching
  const playersWithMorePoints = await getPlayersWithMorePoints(points)
  const rank = playersWithMorePoints + 1
  
  return c.json({
    handle: player.xHandle,
    profilePic: player.xProfilePic,
    verified: player.verified,
    card: player.card,
    stats: {
      trades: tradeCount,
      points,
      rank
    }
  })
})

// Get player's current card
playerRoutes.get('/:handle/card', async (c: Context) => {
  const handle = c.req.param('handle')
  
  const player = await prisma.player.findUnique({
    where: { xHandle: handle },
    include: { card: true }
  })
  
  if (!player?.card) {
    return c.json({ error: 'Player or card not found' }, 404)
  }
  
  return c.json(player.card)
})

// Get leaderboard
playerRoutes.get('/', async (c: Context) => {
  const limit = Math.min(
    parseInt(c.req.query('limit') || String(LEADERBOARD_DEFAULT_LIMIT)),
    LEADERBOARD_MAX_LIMIT
  )
  const offset = parseInt(c.req.query('offset') || '0')
  
  // Get verified players with their trade counts
  const verifiedPlayers = await prisma.player.findMany({
    where: { verified: true },
    include: {
      tradesAsPlayerA: {
        include: { playerB: { select: { verified: true } } }
      },
      tradesAsPlayerB: {
        include: { playerA: { select: { verified: true } } }
      }
    }
  })
  
  // Calculate points for each player
  const leaderboardData = verifiedPlayers.map(player => {
    const allTrades = [...player.tradesAsPlayerA, ...player.tradesAsPlayerB]
    const verifiedTrades = allTrades.filter(t => {
      const otherPlayerVerified = 'playerB' in t 
        ? t.playerB.verified 
        : t.playerA.verified
      return otherPlayerVerified
    })
    
    // Count unique verified trading partners
    const uniquePartners = new Set(
      verifiedTrades.map(t => 
        'playerB' in t ? (t as any).playerBId : (t as any).playerAId
      )
    )
    
    return {
      xHandle: player.xHandle,
      verified: player.verified,
      trades: allTrades.length,
      points: uniquePartners.size
    }
  })
  
  // Sort by points, then trades
  leaderboardData.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return b.trades - a.trades
  })
  
  // Add ranks and paginate
  const entries = leaderboardData
    .slice(offset, offset + limit)
    .map((entry, index) => ({
      rank: offset + index + 1,
      ...entry
    }))
  
  return c.json({
    entries,
    total: verifiedPlayers.length,
    offset,
    limit
  })
})

// Helper function to count players with more points
async function getPlayersWithMorePoints(points: number): Promise<number> {
  // This is a simplified implementation
  // For production, consider maintaining a materialized leaderboard
  const verifiedPlayers = await prisma.player.findMany({
    where: { verified: true },
    include: {
      tradesAsPlayerA: {
        where: { playerB: { verified: true } }
      },
      tradesAsPlayerB: {
        where: { playerA: { verified: true } }
      }
    }
  })
  
  let count = 0
  for (const player of verifiedPlayers) {
    const allVerifiedTrades = [
      ...player.tradesAsPlayerA,
      ...player.tradesAsPlayerB
    ]
    const uniquePartners = new Set(
      allVerifiedTrades.map(t => 
        (t as any).playerAId === player.id 
          ? (t as any).playerBId 
          : (t as any).playerAId
      )
    )
    if (uniquePartners.size > points) count++
  }
  
  return count
}
