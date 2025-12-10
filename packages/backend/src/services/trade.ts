import { prisma } from '../db'
import type { Trade, TradePayload, TradeResult, Founder } from '@seedhunter/shared'
import { TRADE_EXPIRY_SECONDS, ErrorCodes } from '@seedhunter/shared'
import { getFounderById } from './founders'

// Secret key for signing trade payloads
const TRADE_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'development-secret-change-in-production'
)

// Admin handles that auto-verify their trading partners
const AUTO_VERIFY_HANDLES = ['spacemandev', 'treggs6']

// ============================================
// Payload Encryption/Signing
// ============================================

/**
 * Create HMAC signature for trade payload
 */
async function createSignature(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    TRADE_SECRET,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data)
  )
  
  return Buffer.from(signature).toString('base64url')
}

/**
 * Verify HMAC signature
 */
async function verifySignature(data: string, signature: string): Promise<boolean> {
  const expectedSig = await createSignature(data)
  return signature === expectedSig
}

/**
 * Encode trade payload for QR code (base64url JSON with signature)
 */
function encodePayload(payload: TradePayload): string {
  const json = JSON.stringify(payload)
  return Buffer.from(json).toString('base64url')
}

/**
 * Decode trade payload from QR data
 */
function decodePayload(encoded: string): TradePayload | null {
  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf-8')
    return JSON.parse(json) as TradePayload
  } catch {
    return null
  }
}

// ============================================
// Trade Initiation
// ============================================

/**
 * Create a trade payload for the initiating player
 */
export async function createTradePayload(
  playerHandle: string
): Promise<{ payload: string; expiresAt: number } | { error: string; code: string }> {
  // Get player and their current project
  const player = await prisma.player.findUnique({
    where: { xHandle: playerHandle }
  })
  
  if (!player) {
    return { error: 'Player not found', code: ErrorCodes.PLAYER_NOT_FOUND }
  }
  
  if (player.gridIndex === null) {
    return { error: 'Player has no project to trade', code: ErrorCodes.VALIDATION_ERROR }
  }
  
  // Generate unique nonce
  const nonce = crypto.randomUUID()
  const expiresAt = Date.now() + (TRADE_EXPIRY_SECONDS * 1000)
  
  // Create payload data (without signature)
  const payloadData = {
    initiator: playerHandle,
    gridIndex: player.gridIndex,
    nonce,
    expiresAt
  }
  
  // Create signature
  const dataToSign = JSON.stringify(payloadData)
  const signature = await createSignature(dataToSign)
  
  const payload: TradePayload = {
    ...payloadData,
    signature
  }
  
  // Store nonce to prevent replay attacks
  await prisma.tradeNonce.create({
    data: {
      nonce,
      expiresAt: new Date(expiresAt)
    }
  })
  
  return {
    payload: encodePayload(payload),
    expiresAt
  }
}

// ============================================
// Trade Validation
// ============================================

interface TradeValidation {
  valid: boolean
  error?: string
  code?: string
  payload?: TradePayload
  initiator?: { id: string; xHandle: string; gridIndex: number }
}

/**
 * Validate a trade payload
 */
export async function validateTrade(
  encodedPayload: string,
  confirmerHandle: string
): Promise<TradeValidation> {
  // Decode payload
  const payload = decodePayload(encodedPayload)
  if (!payload) {
    return { valid: false, error: 'Invalid payload format', code: ErrorCodes.VALIDATION_ERROR }
  }
  
  // Check expiry
  if (payload.expiresAt < Date.now()) {
    return { valid: false, error: 'Trade has expired', code: ErrorCodes.TRADE_EXPIRED }
  }
  
  // Verify signature
  const { signature, ...payloadData } = payload
  const dataToVerify = JSON.stringify(payloadData)
  const validSig = await verifySignature(dataToVerify, signature)
  
  if (!validSig) {
    return { valid: false, error: 'Invalid signature', code: ErrorCodes.TRADE_INVALID_SIGNATURE }
  }
  
  // Check self-trade
  if (payload.initiator === confirmerHandle) {
    return { valid: false, error: 'Cannot trade with yourself', code: ErrorCodes.TRADE_SELF_TRADE }
  }
  
  // Check nonce hasn't been used
  const nonceRecord = await prisma.tradeNonce.findUnique({
    where: { nonce: payload.nonce }
  })
  
  if (!nonceRecord) {
    return { valid: false, error: 'Trade nonce already used or invalid', code: ErrorCodes.TRADE_NONCE_USED }
  }
  
  // Get initiator player
  const initiator = await prisma.player.findUnique({
    where: { xHandle: payload.initiator },
    select: { id: true, xHandle: true, gridIndex: true, artStyle: true }
  })
  
  if (!initiator) {
    return { valid: false, error: 'Initiator not found', code: ErrorCodes.PLAYER_NOT_FOUND }
  }
  
  // Verify initiator still has the same project
  if (initiator.gridIndex !== payload.gridIndex) {
    return { valid: false, error: 'Initiator project has changed', code: ErrorCodes.VALIDATION_ERROR }
  }
  
  return {
    valid: true,
    payload,
    initiator: {
      id: initiator.id,
      xHandle: initiator.xHandle,
      gridIndex: initiator.gridIndex!
    }
  }
}

// ============================================
// Trade Execution
// ============================================

/**
 * Execute a trade between two players
 */
export async function executeTrade(
  encodedPayload: string,
  confirmerHandle: string
): Promise<TradeResult> {
  // Validate the trade
  const validation = await validateTrade(encodedPayload, confirmerHandle)

  if (!validation.valid || !validation.payload || !validation.initiator) {
    return {
      success: false,
      error: validation.error || 'Invalid trade'
    }
  }

  const { payload, initiator } = validation

  // Get confirmer player
  const confirmer = await prisma.player.findUnique({
    where: { xHandle: confirmerHandle },
    select: { id: true, xHandle: true, gridIndex: true, artStyle: true, verified: true }
  })
  
  if (!confirmer) {
    return { success: false, error: 'Confirmer not found' }
  }
  
  if (confirmer.gridIndex === null) {
    return { success: false, error: 'Confirmer has no project to trade' }
  }
  
  // Get full player data including artStyle and verified status
  const initiatorFull = await prisma.player.findUnique({
    where: { id: initiator.id },
    select: { artStyle: true, verified: true }
  })
  
  // Execute the trade in a transaction
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Delete the nonce to prevent replay
      await tx.tradeNonce.delete({
        where: { nonce: payload.nonce }
      })
      
      // Swap complete card variants (gridIndex + artStyle)
      // Each card is uniquely identified by both gridIndex and artStyle
      await tx.player.update({
        where: { id: initiator.id },
        data: { 
          gridIndex: confirmer.gridIndex,
          artStyle: confirmer.artStyle
        }
      })
      
      await tx.player.update({
        where: { id: confirmer.id },
        data: { 
          gridIndex: initiator.gridIndex,
          artStyle: initiatorFull?.artStyle
        }
      })
      
      // Record the trade
      const trade = await tx.trade.create({
        data: {
          playerAId: initiator.id,
          playerBId: confirmer.id,
          gridIndexA: initiator.gridIndex,
          gridIndexB: confirmer.gridIndex!
        }
      })
      
      return {
        trade,
        initiatorGridIndex: initiator.gridIndex,
        initiatorArtStyle: initiatorFull?.artStyle,
        confirmerGridIndex: confirmer.gridIndex!
      }
    })
    
    // Format response
    const trade: Trade = {
      id: result.trade.id,
      playerA: initiator.xHandle,
      playerB: confirmerHandle,
      gridIndexA: result.trade.gridIndexA,
      gridIndexB: result.trade.gridIndexB,
      timestamp: result.trade.tradedAt.getTime()
    }
    
    // Fetch the founder that confirmer received (initiator's old card variant)
    const newProject = getFounderById(result.initiatorGridIndex, result.initiatorArtStyle)
    
    // Auto-verify trading partners of admin accounts
    const initiatorIsAdmin = AUTO_VERIFY_HANDLES.includes(initiator.xHandle.toLowerCase())
    const confirmerIsAdmin = AUTO_VERIFY_HANDLES.includes(confirmerHandle.toLowerCase())
    
    if (initiatorIsAdmin && !confirmer.verified) {
      // Admin initiated trade with unverified player -> verify the confirmer
      await prisma.player.update({
        where: { id: confirmer.id },
        data: {
          verified: true,
          verifiedAt: new Date(),
          verifiedBy: `auto:${initiator.xHandle}`
        }
      })
      console.log(`Auto-verified ${confirmerHandle} via trade with admin ${initiator.xHandle}`)
    } else if (confirmerIsAdmin && !initiatorFull?.verified) {
      // Unverified player initiated trade with admin -> verify the initiator
      await prisma.player.update({
        where: { id: initiator.id },
        data: {
          verified: true,
          verifiedAt: new Date(),
          verifiedBy: `auto:${confirmerHandle}`
        }
      })
      console.log(`Auto-verified ${initiator.xHandle} via trade with admin ${confirmerHandle}`)
    }
    
    return {
      success: true,
      trade,
      newProject: newProject || undefined
    }
  } catch (error) {
    console.error('Trade execution error:', error)
    return {
      success: false,
      error: 'Failed to execute trade'
    }
  }
}

// ============================================
// Trade History
// ============================================

/**
 * Get trade history for a player
 */
export async function getTradeHistory(
  playerHandle: string,
  limit: number = 50
): Promise<Trade[]> {
  const player = await prisma.player.findUnique({
    where: { xHandle: playerHandle }
  })
  
  if (!player) return []
  
  const trades = await prisma.trade.findMany({
    where: {
      OR: [
        { playerAId: player.id },
        { playerBId: player.id }
      ]
    },
    include: {
      playerA: { select: { xHandle: true } },
      playerB: { select: { xHandle: true } }
    },
    orderBy: { tradedAt: 'desc' },
    take: limit
  })
  
  return trades.map(t => ({
    id: t.id,
    playerA: t.playerA.xHandle,
    playerB: t.playerB.xHandle,
    gridIndexA: t.gridIndexA,
    gridIndexB: t.gridIndexB,
    timestamp: t.tradedAt.getTime()
  }))
}

// ============================================
// Nonce Cleanup
// ============================================

/**
 * Clean up expired trade nonces
 */
export async function cleanupExpiredNonces(): Promise<number> {
  const result = await prisma.tradeNonce.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  })
  return result.count
}
