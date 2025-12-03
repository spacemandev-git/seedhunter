import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { serveStatic } from 'hono/bun'

import { authRoutes } from './routes/auth'
import { playerRoutes } from './routes/players'
import { tradeRoutes } from './routes/trades'
import { adminRoutes } from './routes/admin'
import { chatRoutes } from './routes/chat'
import { websocket } from './ws/handler'
import { initDB } from './db'
import { getTotalProjects, getProjectByIndex } from './services/grid'

// Initialize database (async)
await initDB()

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: (origin) => {
    // Allow any origin in development or when accessed via ngrok
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://localhost:4173',
      'https://seedhunter.seedplex.io',
      'capacitor://localhost',
      'http://localhost',
      'https://localhost', // Android Capacitor WebView
    ]
    // Allow ngrok URLs
    if (origin?.includes('.ngrok.app') || origin?.includes('.ngrok-free.app')) {
      return origin
    }
    // Allow Android WebView (origin is null for capacitor/file://)
    if (!origin) {
      return '*'
    }
    // Check against allowed list
    if (allowedOrigins.includes(origin)) {
      return origin
    }
    // For development, allow any localhost (http or https, any port)
    if (origin?.includes('localhost') || origin?.includes('127.0.0.1')) {
      return origin
    }
    return allowedOrigins[0]
  },
  credentials: true,
}))

// Static files (card images)
app.use('/static/*', serveStatic({ root: './' }))

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }))

// Grid API endpoints
app.get('/grid/stats', async (c) => {
  try {
    const totalProjects = await getTotalProjects()
    return c.json({ totalProjects })
  } catch (error) {
    console.error('Grid stats error:', error)
    return c.json({ error: 'Failed to get grid stats' }, 500)
  }
})

app.get('/grid/project/:index', async (c) => {
  const index = parseInt(c.req.param('index'))
  
  if (isNaN(index) || index < 0) {
    return c.json({ error: 'Invalid project index' }, 400)
  }
  
  try {
    const project = await getProjectByIndex(index)
    
    if (!project) {
      return c.json({ error: 'Project not found' }, 404)
    }
    
    return c.json(project)
  } catch (error) {
    console.error('Grid project error:', error)
    return c.json({ error: 'Failed to get project' }, 500)
  }
})

// API routes
app.route('/auth', authRoutes)
app.route('/players', playerRoutes)
app.route('/trades', tradeRoutes)
app.route('/admin', adminRoutes)
app.route('/chat', chatRoutes)

// 404 handler
app.notFound((c) => c.json({ error: 'Not found' }, 404))

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  return c.json({ error: 'Internal server error' }, 500)
})

const port = parseInt(process.env.PORT || '3000')
const host = process.env.HOST || '0.0.0.0'

console.log(`🌱 Seedhunter backend starting on ${host}:${port}`)

// Use Bun.serve() directly for WebSocket support
const server = Bun.serve({
  port,
  hostname: host,
  fetch(req, server) {
    // Check for WebSocket upgrade on /ws path
    const url = new URL(req.url)
    if (url.pathname === '/ws') {
      const token = url.searchParams.get('token')
      const upgraded = server.upgrade(req, {
        data: {
          id: crypto.randomUUID(),
          token: token || null,
          playerHandle: null,
          isAdmin: false,
          channels: new Set(['chat', 'verifications', 'locations']),
        }
      })
      if (upgraded) {
        return // Bun handles the response for successful upgrades
      }
      return new Response('WebSocket upgrade failed', { status: 500 })
    }
    
    // Pass to Hono for all other requests
    return app.fetch(req)
  },
  websocket,
})

console.log(`🚀 Server running at http://${server.hostname}:${server.port}`)
