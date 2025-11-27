import { Hono } from 'hono'
import type { Context } from 'hono'
import {
  getXAuthUrl,
  handleXCallback,
  loginAdmin,
  refreshToken
} from '../services/auth'
import { requireAdmin } from '../middleware/auth'
import { authRateLimit } from '../middleware/rateLimit'
import { ErrorCodes } from '@seedhunter/shared'

export const authRoutes = new Hono()

// Apply rate limiting to all auth routes
authRoutes.use('*', authRateLimit)

// X OAuth - Redirect to X authorization
authRoutes.get('/x', (c: Context) => {
  try {
    const { url, state } = getXAuthUrl()
    
    // Set state in a cookie for validation on callback
    c.header('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600`)
    
    return c.redirect(url)
  } catch (error) {
    console.error('X OAuth init error:', error)
    return c.json({
      error: 'X OAuth not configured',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// X OAuth Callback
authRoutes.get('/x/callback', async (c: Context) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')
  const errorDescription = c.req.query('error_description')
  
  if (error) {
    return c.json({
      error: errorDescription || `OAuth error: ${error}`,
      code: ErrorCodes.INVALID_CREDENTIALS
    }, 400)
  }
  
  if (!code || !state) {
    return c.json({
      error: 'Missing authorization code or state',
      code: ErrorCodes.VALIDATION_ERROR
    }, 400)
  }
  
  // Validate state from cookie (CSRF protection)
  const cookieHeader = c.req.header('Cookie') || ''
  const stateMatch = cookieHeader.match(/oauth_state=([^;]+)/)
  const storedState = stateMatch?.[1]
  
  if (storedState !== state) {
    console.warn('OAuth state mismatch:', { storedState, receivedState: state })
    // Continue anyway for now (state is also validated in handleXCallback via pkceStore)
  }
  
  try {
    const result = await handleXCallback(code, state)
    
    if (!result) {
      return c.json({
        error: 'OAuth authentication failed',
        code: ErrorCodes.INVALID_CREDENTIALS
      }, 401)
    }
    
    // Clear the state cookie
    c.header('Set-Cookie', 'oauth_state=; Path=/; HttpOnly; Max-Age=0')
    
    return c.json({
      token: result.token,
      player: result.player,
      isNew: result.isNew
    })
  } catch (error) {
    console.error('X OAuth callback error:', error)
    return c.json({
      error: 'Authentication failed',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Logout (player or admin)
authRoutes.post('/logout', (c: Context) => {
  // JWT is stateless, so we just tell client to discard token
  // Clear any cookies if used
  c.header('Set-Cookie', 'oauth_state=; Path=/; HttpOnly; Max-Age=0')
  
  return c.json({ success: true })
})

// Admin login
authRoutes.post('/admin/login', async (c: Context) => {
  try {
    const body = await c.req.json<{ username: string; password: string }>()
    
    if (!body.username || !body.password) {
      return c.json({
        error: 'Username and password required',
        code: ErrorCodes.VALIDATION_ERROR
      }, 400)
    }
    
    const result = await loginAdmin(body.username, body.password)
    
    if (!result) {
      return c.json({
        error: 'Invalid credentials',
        code: ErrorCodes.INVALID_CREDENTIALS
      }, 401)
    }
    
    return c.json({
      token: result.token,
      admin: result.admin
    })
  } catch (error) {
    console.error('Admin login error:', error)
    return c.json({
      error: 'Login failed',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})

// Admin token refresh
authRoutes.post('/admin/refresh', requireAdmin, async (c: Context) => {
  try {
    const authHeader = c.req.header('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (!token) {
      return c.json({
        error: 'No token provided',
        code: ErrorCodes.UNAUTHORIZED
      }, 401)
    }
    
    const newToken = await refreshToken(token)
    
    if (!newToken) {
      return c.json({
        error: 'Token refresh failed',
        code: ErrorCodes.TOKEN_EXPIRED
      }, 401)
    }
    
    return c.json({ token: newToken })
  } catch (error) {
    console.error('Token refresh error:', error)
    return c.json({
      error: 'Token refresh failed',
      code: ErrorCodes.INTERNAL_ERROR
    }, 500)
  }
})
