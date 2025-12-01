import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

// Database URL from environment
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/seedhunter'

// Create PostgreSQL connection pool
const pool = new pg.Pool({ connectionString })

// Create Prisma adapter for PostgreSQL
const adapter = new PrismaPg(pool)

// Create Prisma client with PostgreSQL adapter
export const prisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'error', 'warn'] 
    : ['error'],
})

// Initialize database connection
export async function initDB() {
  try {
    // Test connection
    await prisma.$connect()
    console.log('📦 Database connected')
    
    // Clean up expired nonces on startup
    const deleted = await prisma.tradeNonce.deleteMany({
      where: {
        expiresAt: { lt: new Date() }
      }
    })
    
    if (deleted.count > 0) {
      console.log(`  Cleaned up ${deleted.count} expired trade nonces`)
    }
    
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    throw error
  }
}

// Graceful shutdown
export async function closeDB() {
  await prisma.$disconnect()
}

// Handle shutdown signals
process.on('beforeExit', async () => {
  await closeDB()
})

// Utility function to generate UUIDs
export function generateId(): string {
  return crypto.randomUUID()
}

// Re-export prisma as db for convenience
export const db = prisma
