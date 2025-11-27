import { Hono } from 'hono'
import type { Context } from 'hono'

export const authRoutes = new Hono()

// X OAuth - Redirect to X authorization
authRoutes.get('/x', (c: Context) => {
  // TODO: Implement X OAuth redirect
  // See: https://developer.twitter.com/en/docs/authentication/oauth-2-0/authorization-code
  
  const clientId = process.env.X_CLIENT_ID
  const callbackUrl = process.env.X_CALLBACK_URL
  const state = crypto.randomUUID()
  const codeChallenge = crypto.randomUUID() // Should use PKCE properly
  
  const authUrl = new URL('https://twitter.com/i/oauth2/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId || '')
  authUrl.searchParams.set('redirect_uri', callbackUrl || '')
  authUrl.searchParams.set('scope', 'tweet.read users.read')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'plain')
  
  // TODO: Store state and code_challenge in session/cookie
  
  return c.redirect(authUrl.toString())
})

// X OAuth Callback
authRoutes.get('/x/callback', async (c: Context) => {
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')
  
  if (error) {
    return c.json({ error: `OAuth error: ${error}` }, 400)
  }
  
  if (!code) {
    return c.json({ error: 'Missing authorization code' }, 400)
  }
  
  // TODO: Verify state matches stored state
  // TODO: Exchange code for access token
  // TODO: Fetch user profile from X API
  // TODO: Create or update player in database
  // TODO: Generate JWT and return
  
  return c.json({ 
    message: 'OAuth callback - implementation pending',
    code,
    state 
  })
})

// Logout
authRoutes.post('/logout', (c: Context) => {
  // JWT is stateless, so we just tell client to discard token
  return c.json({ success: true })
})

// Admin login
authRoutes.post('/admin/login', async (c: Context) => {
  const body = await c.req.json<{ username: string; password: string }>()
  
  if (!body.username || !body.password) {
    return c.json({ error: 'Username and password required' }, 400)
  }
  
  // TODO: Verify credentials against database
  // TODO: Generate admin JWT
  
  return c.json({ 
    message: 'Admin login - implementation pending',
    username: body.username 
  })
})

// Admin token refresh
authRoutes.post('/admin/refresh', async (c: Context) => {
  // TODO: Verify existing token and issue new one
  return c.json({ message: 'Token refresh - implementation pending' })
})
