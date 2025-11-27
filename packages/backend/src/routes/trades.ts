import { Hono } from 'hono'
import type { Context } from 'hono'
import { ErrorCodes } from '@seedhunter/shared'
import {
  createTradePayload,
  executeTrade,
  getTradeHistory
} from '../services/trade'
import { requirePlayer } from '../middleware/auth'
import { tradeRateLimit } from '../middleware/rateLimit'
import { broadcast } from '../ws/handler'

export const tradeRoutes = new Hono()

// Apply rate limiting to all trade routes
tradeRoutes.use('*', tradeRateLimit)

// Initialize a trade (generate QR payload)
tradeRoutes.post('/init', requirePlayer, async (c: Context) => {
  const player = c.get('player')!
  
  try {
    const result = await createTradePayload(player.xHandle)
    
    if ('error' in result) {
      return c.json({
        error: result.error,
        code: result.code
      }, 400)
    }
    
    return c.json({
      payload: result.payload,
      expiresAt: result.expiresAt
    })
  } catch (error) {
    console.error('Trade init error:', error)
    return c.json({
      error: 'Failed to initialize trade',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Confirm a trade
tradeRoutes.post('/confirm', requirePlayer, async (c: Context) => {
  const player = c.get('player')!
  
  try {
    const body = await c.req.json<{ payload: string }>()
    
    if (!body.payload) {
      return c.json({
        error: 'Missing trade payload',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    const result = await executeTrade(body.payload, player.xHandle)
    
    if (!result.success) {
      return c.json({
        error: result.error || 'Trade failed',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    // Broadcast trade completion via WebSocket
    if (result.trade) {
      broadcast('trades', {
        type: 'trade_complete',
        trade: result.trade
      })
    }
    
    return c.json({
      success: true,
      trade: result.trade,
      newCard: result.newCard
    })
  } catch (error) {
    console.error('Trade confirm error:', error)
    return c.json({
      error: 'Failed to confirm trade',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Get trade history for authenticated player
tradeRoutes.get('/history', requirePlayer, async (c: Context) => {
  const player = c.get('player')!
  
  try {
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    const trades = await getTradeHistory(player.xHandle, limit)
    
    return c.json({ trades })
  } catch (error) {
    console.error('Trade history error:', error)
    return c.json({
      error: 'Failed to get trade history',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})
