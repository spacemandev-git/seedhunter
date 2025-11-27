import { defineConfig } from 'prisma/config'

// Bun automatically loads .env files, no need for dotenv

export default defineConfig({
  // Path to Prisma schema
  schema: './prisma/schema.prisma',

  // Database connection URL
  datasource: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },

  // Migrations configuration
  migrations: {
    seed: 'bun run src/db/seed.ts',
  },
})
