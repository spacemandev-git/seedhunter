import { defineConfig } from 'prisma/config'

// Bun automatically loads .env files, no need for dotenv

export default defineConfig({
  // Path to Prisma schema
  schema: './prisma/schema.prisma',

  // Database connection URL (PostgreSQL)
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/seedhunter',
  },

  // Migrations configuration
  migrations: {
    seed: 'bun run src/db/seed.ts',
  },
})
