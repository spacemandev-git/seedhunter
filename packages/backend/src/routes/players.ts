import { Hono } from 'hono'
import type { Context } from 'hono'
import { db } from '../db'
import { LEADERBOARD_DEFAULT_LIMIT, LEADERBOARD_MAX_LIMIT } from '@seedhunter/shared'

export const playerRoutes = new Hono()

// Get player by handle
playerRoutes.get('/:handle', (c: Context) => {
  const handle = c.req.param('handle')
  
  const player = db.prepare(`
    SELECT 
      id, x_handle, x_profile_pic, card_id, verified, verified_at, created_at
    FROM players 
    WHERE x_handle = ?
  `).get(handle)
  
  if (!player) {
    return c.json({ error: 'Player not found' }, 404)
  }
  
  // Get player's card
  const card = db.prepare(`
    SELECT * FROM cards WHERE id = ?
  `).get((player as any).card_id)
  
  // Calculate stats
  const trades = db.prepare(`
    SELECT COUNT(*) as count FROM trades 
    WHERE player_a = ? OR player_b = ?
  `).get(handle, handle) as { count: number }
  
  // Points = unique verified trades (both parties verified)
  const points = db.prepare(`
    SELECT COUNT(DISTINCT 
      CASE 
        WHEN player_a = ? THEN player_b 
        ELSE player_a 
      END
    ) as count
    FROM trades t
    JOIN players p1 ON t.player_a = p1.x_handle
    JOIN players p2 ON t.player_b = p2.x_handle
    WHERE (t.player_a = ? OR t.player_b = ?)
      AND p1.verified = 1 
      AND p2.verified = 1
  `).get(handle, handle, handle) as { count: number }
  
  // Get rank
  const rank = db.prepare(`
    WITH player_points AS (
      SELECT 
        p.x_handle,
        COUNT(DISTINCT 
          CASE 
            WHEN t.player_a = p.x_handle THEN t.player_b 
            ELSE t.player_a 
          END
        ) as points
      FROM players p
      LEFT JOIN trades t ON t.player_a = p.x_handle OR t.player_b = p.x_handle
      LEFT JOIN players p1 ON t.player_a = p1.x_handle AND p1.verified = 1
      LEFT JOIN players p2 ON t.player_b = p2.x_handle AND p2.verified = 1
      WHERE p.verified = 1
      GROUP BY p.x_handle
    )
    SELECT COUNT(*) + 1 as rank 
    FROM player_points 
    WHERE points > (SELECT COALESCE(points, 0) FROM player_points WHERE x_handle = ?)
  `).get(handle) as { rank: number }
  
  return c.json({
    handle: (player as any).x_handle,
    profilePic: (player as any).x_profile_pic,
    verified: Boolean((player as any).verified),
    card,
    stats: {
      trades: trades.count,
      points: points.count,
      rank: rank.rank
    }
  })
})

// Get player's current card
playerRoutes.get('/:handle/card', (c: Context) => {
  const handle = c.req.param('handle')
  
  const result = db.prepare(`
    SELECT c.* FROM cards c
    JOIN players p ON p.card_id = c.id
    WHERE p.x_handle = ?
  `).get(handle)
  
  if (!result) {
    return c.json({ error: 'Player or card not found' }, 404)
  }
  
  return c.json(result)
})

// Get leaderboard
playerRoutes.get('/', (c: Context) => {
  const limit = Math.min(
    parseInt(c.req.query('limit') || String(LEADERBOARD_DEFAULT_LIMIT)),
    LEADERBOARD_MAX_LIMIT
  )
  const offset = parseInt(c.req.query('offset') || '0')
  
  // Get leaderboard with points calculation
  const entries = db.prepare(`
    WITH player_points AS (
      SELECT 
        p.x_handle,
        p.verified,
        COUNT(DISTINCT t.id) as trades,
        COUNT(DISTINCT 
          CASE 
            WHEN t.player_a = p.x_handle AND p2.verified = 1 THEN t.player_b 
            WHEN t.player_b = p.x_handle AND p1.verified = 1 THEN t.player_a
            ELSE NULL
          END
        ) as points
      FROM players p
      LEFT JOIN trades t ON t.player_a = p.x_handle OR t.player_b = p.x_handle
      LEFT JOIN players p1 ON t.player_a = p1.x_handle
      LEFT JOIN players p2 ON t.player_b = p2.x_handle
      WHERE p.verified = 1
      GROUP BY p.x_handle, p.verified
    )
    SELECT 
      x_handle,
      verified,
      trades,
      points,
      ROW_NUMBER() OVER (ORDER BY points DESC, trades DESC) as rank
    FROM player_points
    ORDER BY points DESC, trades DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset)
  
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM players WHERE verified = 1
  `).get() as { count: number }
  
  return c.json({
    entries: entries.map((e: any) => ({
      rank: e.rank,
      xHandle: e.x_handle,
      points: e.points,
      trades: e.trades,
      verified: Boolean(e.verified)
    })),
    total: total.count,
    offset,
    limit
  })
})
