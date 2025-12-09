import { SignJWT, jwtVerify, type JWTPayload } from 'jose'
import { prisma } from '../db'
import type { TokenPayload, Admin, XProfile } from '@seedhunter/shared'
import { getRandomCardVariant } from './founders'

// JWT secret as Uint8Array for jose
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'development-secret-change-in-production'
)

const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'
const ADMIN_JWT_EXPIRES_IN = process.env.ADMIN_JWT_EXPIRES_IN || '24h'

// ============================================
// JWT Functions
// ============================================

/**
 * Generate a JWT token for a player or admin
 */
export async function generateToken(
  payload: Omit<TokenPayload, 'iat' | 'exp'>,
  expiresIn: string = JWT_EXPIRES_IN
): Promise<string> {
  const jwt = new SignJWT({ ...payload } as unknown as JWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
  
  return jwt.sign(JWT_SECRET)
}

/**
 * Verify and decode a JWT token
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as TokenPayload
  } catch (error) {
    return null
  }
}

/**
 * Refresh an existing token (extends expiry)
 */
export async function refreshToken(token: string): Promise<string | null> {
  const payload = await verifyToken(token)
  if (!payload) return null
  
  const expiresIn = payload.type === 'admin' ? ADMIN_JWT_EXPIRES_IN : JWT_EXPIRES_IN
  return generateToken({ sub: payload.sub, type: payload.type }, expiresIn)
}

// ============================================
// Password Functions
// ============================================

/**
 * Hash a password using Bun's built-in hasher
 */
export async function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: 'bcrypt',
    cost: 10
  })
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash)
}

// ============================================
// Admin Auth Functions
// ============================================

/**
 * Authenticate admin with username/password
 */
export async function loginAdmin(
  username: string,
  password: string
): Promise<{ token: string; admin: Omit<Admin, 'passwordHash'> } | null> {
  const admin = await prisma.admin.findUnique({
    where: { username }
  })
  
  if (!admin) return null
  
  const valid = await verifyPassword(password, admin.passwordHash)
  if (!valid) return null
  
  const token = await generateToken(
    { sub: admin.id, type: 'admin' },
    ADMIN_JWT_EXPIRES_IN
  )
  
  return {
    token,
    admin: {
      id: admin.id,
      username: admin.username,
      locationLat: admin.locationLat,
      locationLng: admin.locationLng,
      locationVisible: admin.locationVisible,
      locationUpdatedAt: admin.locationUpdatedAt?.getTime() ?? null,
      createdAt: admin.createdAt.getTime()
    }
  }
}

/**
 * Get admin by ID (from JWT sub)
 */
export async function getAdminById(id: string): Promise<Omit<Admin, 'passwordHash'> | null> {
  const admin = await prisma.admin.findUnique({
    where: { id }
  })
  
  if (!admin) return null
  
  return {
    id: admin.id,
    username: admin.username,
    locationLat: admin.locationLat,
    locationLng: admin.locationLng,
    locationVisible: admin.locationVisible,
    locationUpdatedAt: admin.locationUpdatedAt?.getTime() ?? null,
    createdAt: admin.createdAt.getTime()
  }
}

// ============================================
// X OAuth Functions
// ============================================

// PKCE state storage (in production, use Redis or similar)
const pkceStore = new Map<string, { codeVerifier: string; expiresAt: number }>()

/**
 * Generate a PKCE code verifier and challenge
 */
function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  // Generate random code verifier (43-128 chars)
  const codeVerifier = crypto.randomUUID() + crypto.randomUUID()
  
  // For S256 challenge, we need to hash the verifier
  const encoder = new TextEncoder()
  const data = encoder.encode(codeVerifier)
  
  // Create SHA256 hash and base64url encode it
  const hashBuffer = new Bun.CryptoHasher('sha256').update(data).digest()
  const codeChallenge = Buffer.from(hashBuffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  
  return { codeVerifier, codeChallenge }
}

/**
 * Generate X OAuth authorization URL
 */
export function getXAuthUrl(): { url: string; state: string } {
  const clientId = process.env.X_CLIENT_ID
  const callbackUrl = process.env.X_CALLBACK_URL
  
  if (!clientId || !callbackUrl) {
    throw new Error('X OAuth credentials not configured')
  }
  
  const state = crypto.randomUUID()
  const { codeVerifier, codeChallenge } = generatePKCE()
  
  // Store PKCE verifier for callback (expires in 10 minutes)
  pkceStore.set(state, {
    codeVerifier,
    expiresAt: Date.now() + 10 * 60 * 1000
  })
  
  // Clean up expired entries
  for (const [key, value] of pkceStore.entries()) {
    if (value.expiresAt < Date.now()) {
      pkceStore.delete(key)
    }
  }
  
  const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', callbackUrl)
  authUrl.searchParams.set('scope', 'tweet.read users.read offline.access')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')
  
  return { url: authUrl.toString(), state }
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeXCode(
  code: string,
  state: string
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  const pkceData = pkceStore.get(state)
  
  if (!pkceData || pkceData.expiresAt < Date.now()) {
    pkceStore.delete(state)
    return null
  }
  
  const clientId = process.env.X_CLIENT_ID
  const clientSecret = process.env.X_CLIENT_SECRET
  const callbackUrl = process.env.X_CALLBACK_URL
  
  if (!clientId || !clientSecret || !callbackUrl) {
    throw new Error('X OAuth credentials not configured')
  }
  
  try {
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl,
        code_verifier: pkceData.codeVerifier
      })
    })
    
    if (!response.ok) {
      console.error('X token exchange failed:', await response.text())
      return null
    }
    
    const data = await response.json() as {
      access_token: string
      refresh_token?: string
    }
    
    // Clean up used PKCE state
    pkceStore.delete(state)
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token
    }
  } catch (error) {
    console.error('X token exchange error:', error)
    return null
  }
}

/**
 * Fetch user profile from X API
 */
export async function getXUserProfile(accessToken: string): Promise<XProfile | null> {
  try {
    const response = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=profile_image_url',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    )
    
    if (!response.ok) {
      console.error('X user fetch failed:', await response.text())
      return null
    }
    
    const data = await response.json() as {
      data: {
        id: string
        username: string
        name: string
        profile_image_url?: string
      }
    }
    
    return {
      id: data.data.id,
      username: data.data.username,
      name: data.data.name,
      profile_image_url: data.data.profile_image_url || ''
    }
  } catch (error) {
    console.error('X user fetch error:', error)
    return null
  }
}

/**
 * Handle full X OAuth callback flow - get/create player and return JWT
 */
export async function handleXCallback(
  code: string,
  state: string
): Promise<{ token: string; player: any; isNew: boolean } | null> {
  // Exchange code for token
  const tokens = await exchangeXCode(code, state)
  if (!tokens) return null
  
  // Get user profile
  const profile = await getXUserProfile(tokens.accessToken)
  if (!profile) return null
  
  // Check if player exists
  let player = await prisma.player.findUnique({
    where: { xHandle: profile.username }
  })
  
  const isNew = !player
  
  if (isNew) {
    // Get a random card variant (gridIndex + artStyle) for the new player
    // Each founder has 2 copies - one per art style
    const { gridIndex, artStyle } = getRandomCardVariant()
    
    // Create new player with random card variant
    player = await prisma.player.create({
      data: {
        xHandle: profile.username,
        xId: profile.id,
        xProfilePic: profile.profile_image_url,
        gridIndex,
        artStyle
      }
    })
  } else {
    // Update profile pic if changed
    if (player!.xProfilePic !== profile.profile_image_url) {
      player = await prisma.player.update({
        where: { id: player!.id },
        data: { xProfilePic: profile.profile_image_url }
      })
    }
  }
  
  // Generate JWT for player
  const token = await generateToken(
    { sub: player!.xHandle, type: 'player' },
    JWT_EXPIRES_IN
  )
  
  return {
    token,
    player: {
      id: player!.id,
      xHandle: player!.xHandle,
      xProfilePic: player!.xProfilePic,
      email: player!.email,
      gridIndex: player!.gridIndex,
      artStyle: player!.artStyle,
      verified: player!.verified,
      verifiedAt: player!.verifiedAt?.getTime() ?? null,
      createdAt: player!.createdAt.getTime()
    },
    isNew
  }
}
