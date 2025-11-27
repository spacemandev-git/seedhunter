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

// Initialize database (async)
await initDB()

const app = new Hono()

// Middleware
app.use('*', logger())
app.use('*', cors({
  origin: ['http://localhost:5173', 'https://seedhunter.seedplex.io'],
  credentials: true,
}))

// Static files (card images)
app.use('/static/*', serveStatic({ root: './' }))

// Health check
app.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }))

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
