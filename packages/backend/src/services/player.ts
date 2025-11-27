import { prisma } from '../db'
import type { Player, PlayerStats, LeaderboardEntry, Card } from '@seedhunter/shared'

// ============================================
// Player CRUD Operations
// ============================================

/**
 * Get a player by their X handle
 */
export async function getPlayerByHandle(handle: string): Promise<Player | null> {
  const player = await prisma.player.findUnique({
    where: { xHandle: handle }
  })
  
  if (!player) return null
  
  return {
    id: player.id,
    xHandle: player.xHandle,
    xProfilePic: player.xProfilePic,
    cardId: player.cardId!,
    verified: player.verified,
    verifiedAt: player.verifiedAt?.getTime() ?? null,
    createdAt: player.createdAt.getTime(),
    lastLocationLat: player.lastLocationLat,
    lastLocationLng: player.lastLocationLng,
    lastLocationAt: player.lastLocationAt?.getTime() ?? null
  }
}

/**
 * Get a player's card
 */
export async function getPlayerCard(handle: string): Promise<Card | null> {
  const player = await prisma.player.findUnique({
    where: { xHandle: handle },
    include: { card: true }
  })
  
  if (!player?.card) return null
  
  return {
    id: player.card.id,
    founderName: player.card.founderName,
    company: player.card.company,
    role: player.card.role || '',
    xHandle: player.card.xHandle,
    category: player.card.category as any,
    imagePath: player.card.imagePath,
    createdAt: player.card.createdAt.getTime()
  }
}

/**
 * Assign a card to a player
 */
export async function assignCard(playerId: string, cardId: string): Promise<void> {
  await prisma.player.update({
    where: { id: playerId },
    data: { cardId }
  })
}

// ============================================
// Stats Calculation
// ============================================

/**
 * Calculate a player's stats (trades, points, rank)
 */
export async function getPlayerStats(handle: string): Promise<PlayerStats | null> {
  const player = await prisma.player.findUnique({
    where: { xHandle: handle }
  })
  
  if (!player) return null
  
  // Count total trades
  const tradeCount = await prisma.trade.count({
    where: {
      OR: [
        { playerAId: player.id },
        { playerBId: player.id }
      ]
    }
  })
  
  // Calculate points (unique verified trading partners)
  const points = await calculatePoints(player.id, player.verified)
  
  // Calculate rank
  const rank = await calculateRank(points)
  
  return {
    trades: tradeCount,
    points,
    rank
  }
}

/**
 * Calculate points for a player
 * Points = number of unique verified trading partners
 * A trade is verified only if BOTH parties are verified
 */
export async function calculatePoints(playerId: string, isVerified: boolean): Promise<number> {
  // If player is not verified, they have 0 points
  if (!isVerified) return 0
  
  // Get all trades where this player participated
  const trades = await prisma.trade.findMany({
    where: {
      OR: [
        { playerAId: playerId },
        { playerBId: playerId }
      ]
    },
    include: {
      playerA: { select: { id: true, verified: true } },
      playerB: { select: { id: true, verified: true } }
    }
  })
  
  // Count unique verified trading partners
  const verifiedPartners = new Set<string>()
  
  for (const trade of trades) {
    if (trade.playerAId === playerId && trade.playerB.verified) {
      verifiedPartners.add(trade.playerBId)
    } else if (trade.playerBId === playerId && trade.playerA.verified) {
      verifiedPartners.add(trade.playerAId)
    }
  }
  
  return verifiedPartners.size
}

/**
 * Calculate rank for a given point value
 */
async function calculateRank(points: number): Promise<number> {
  // Count how many verified players have more points
  const verifiedPlayers = await prisma.player.findMany({
    where: { verified: true },
    select: { id: true }
  })
  
  let playersWithMorePoints = 0
  
  for (const player of verifiedPlayers) {
    const playerPoints = await calculatePoints(player.id, true)
    if (playerPoints > points) {
      playersWithMorePoints++
    }
  }
  
  return playersWithMorePoints + 1
}

// ============================================
// Leaderboard
// ============================================

/**
 * Get leaderboard entries
 */
export async function getLeaderboard(
  limit: number = 50,
  offset: number = 0
): Promise<{ entries: LeaderboardEntry[]; total: number }> {
  // Get all verified players with their trade counts
  const verifiedPlayers = await prisma.player.findMany({
    where: { verified: true },
    include: {
      tradesAsPlayerA: {
        include: { playerB: { select: { id: true, verified: true } } }
      },
      tradesAsPlayerB: {
        include: { playerA: { select: { id: true, verified: true } } }
      }
    }
  })
  
  // Calculate points for each player
  const leaderboardData: Array<{
    xHandle: string
    verified: boolean
    trades: number
    points: number
  }> = []
  
  for (const player of verifiedPlayers) {
    const allTrades = [...player.tradesAsPlayerA, ...player.tradesAsPlayerB]
    
    // Count unique verified trading partners
    const verifiedPartners = new Set<string>()
    
    for (const trade of player.tradesAsPlayerA) {
      if (trade.playerB.verified) {
        verifiedPartners.add(trade.playerBId)
      }
    }
    
    for (const trade of player.tradesAsPlayerB) {
      if (trade.playerA.verified) {
        verifiedPartners.add(trade.playerAId)
      }
    }
    
    leaderboardData.push({
      xHandle: player.xHandle,
      verified: player.verified,
      trades: allTrades.length,
      points: verifiedPartners.size
    })
  }
  
  // Sort by points (desc), then trades (desc)
  leaderboardData.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return b.trades - a.trades
  })
  
  // Add ranks and paginate
  const entries = leaderboardData
    .slice(offset, offset + limit)
    .map((entry, index) => ({
      rank: offset + index + 1,
      xHandle: entry.xHandle,
      points: entry.points,
      trades: entry.trades,
      verified: entry.verified
    }))
  
  return {
    entries,
    total: verifiedPlayers.length
  }
}

// ============================================
// Verification
// ============================================

/**
 * Verify a player (admin action)
 */
export async function verifyPlayer(
  handle: string,
  adminId: string
): Promise<{ player: Player; tradesVerified: number } | null> {
  const player = await prisma.player.findUnique({
    where: { xHandle: handle }
  })
  
  if (!player) return null
  
  if (player.verified) {
    // Already verified
    return {
      player: {
        id: player.id,
        xHandle: player.xHandle,
        xProfilePic: player.xProfilePic,
        cardId: player.cardId!,
        verified: true,
        verifiedAt: player.verifiedAt?.getTime() ?? null,
        createdAt: player.createdAt.getTime(),
        lastLocationLat: player.lastLocationLat,
        lastLocationLng: player.lastLocationLng,
        lastLocationAt: player.lastLocationAt?.getTime() ?? null
      },
      tradesVerified: 0
    }
  }
  
  // Verify the player
  const updatedPlayer = await prisma.player.update({
    where: { id: player.id },
    data: {
      verified: true,
      verifiedAt: new Date(),
      verifiedBy: adminId
    }
  })
  
  // Count trades that just became fully verified
  // (trades where both parties are now verified)
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
  
  return {
    player: {
      id: updatedPlayer.id,
      xHandle: updatedPlayer.xHandle,
      xProfilePic: updatedPlayer.xProfilePic,
      cardId: updatedPlayer.cardId!,
      verified: true,
      verifiedAt: updatedPlayer.verifiedAt?.getTime() ?? null,
      createdAt: updatedPlayer.createdAt.getTime(),
      lastLocationLat: updatedPlayer.lastLocationLat,
      lastLocationLng: updatedPlayer.lastLocationLng,
      lastLocationAt: updatedPlayer.lastLocationAt?.getTime() ?? null
    },
    tradesVerified
  }
}

// ============================================
// Location (Optional Feature)
// ============================================

/**
 * Update player location (for nearby players feature)
 */
export async function updatePlayerLocation(
  playerId: string,
  lat: number,
  lng: number
): Promise<void> {
  await prisma.player.update({
    where: { id: playerId },
    data: {
      lastLocationLat: lat,
      lastLocationLng: lng,
      lastLocationAt: new Date()
    }
  })
}

/**
 * Get nearby players within a radius
 */
export async function getNearbyPlayers(
  lat: number,
  lng: number,
  radiusMeters: number,
  maxAgeMs: number = 15 * 60 * 1000 // 15 minutes
): Promise<Array<{ xHandle: string; distance: number; lastSeenAt: number }>> {
  const cutoffTime = new Date(Date.now() - maxAgeMs)
  
  const players = await prisma.player.findMany({
    where: {
      lastLocationAt: { gte: cutoffTime },
      lastLocationLat: { not: null },
      lastLocationLng: { not: null }
    },
    select: {
      xHandle: true,
      lastLocationLat: true,
      lastLocationLng: true,
      lastLocationAt: true
    }
  })
  
  // Calculate distances and filter by radius
  const nearbyPlayers: Array<{ xHandle: string; distance: number; lastSeenAt: number }> = []
  
  for (const player of players) {
    const distance = haversineDistance(
      lat, lng,
      player.lastLocationLat!, player.lastLocationLng!
    )
    
    if (distance <= radiusMeters) {
      nearbyPlayers.push({
        xHandle: player.xHandle,
        distance: Math.round(distance),
        lastSeenAt: player.lastLocationAt!.getTime()
      })
    }
  }
  
  // Sort by distance
  nearbyPlayers.sort((a, b) => a.distance - b.distance)
  
  return nearbyPlayers
}

/**
 * Calculate distance between two points using Haversine formula
 */
function haversineDistance(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371000 // Earth's radius in meters
  
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}
