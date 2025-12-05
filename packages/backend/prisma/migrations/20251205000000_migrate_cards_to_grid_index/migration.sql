-- Migration: Convert from cards system to grid index system
-- This migration removes the cards table and switches to using gridIndex from The Grid API

-- Step 1: Drop foreign key constraints that reference cards
ALTER TABLE "players" DROP CONSTRAINT IF EXISTS "players_card_id_fkey";
ALTER TABLE "trades" DROP CONSTRAINT IF EXISTS "trades_card_a_id_fkey";
ALTER TABLE "trades" DROP CONSTRAINT IF EXISTS "trades_card_b_id_fkey";

-- Step 2: Add new columns to players table
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "grid_index" INTEGER;

-- Step 3: Remove old card_id column from players (after data migration if needed)
ALTER TABLE "players" DROP COLUMN IF EXISTS "card_id";

-- Step 4: Add new grid index columns to trades table
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "grid_index_a" INTEGER;
ALTER TABLE "trades" ADD COLUMN IF NOT EXISTS "grid_index_b" INTEGER;

-- Step 5: Remove old card ID columns from trades (after data migration if needed)
ALTER TABLE "trades" DROP COLUMN IF EXISTS "card_a_id";
ALTER TABLE "trades" DROP COLUMN IF EXISTS "card_b_id";

-- Step 6: Drop the cards table entirely
DROP TABLE IF EXISTS "cards";

-- Step 7: Add location columns to trade_nonces if they don't exist
ALTER TABLE "trade_nonces" ADD COLUMN IF NOT EXISTS "location_lat" DOUBLE PRECISION;
ALTER TABLE "trade_nonces" ADD COLUMN IF NOT EXISTS "location_lng" DOUBLE PRECISION;

-- Step 8: Remove old unique index on players.card_id if it exists
DROP INDEX IF EXISTS "players_card_id_key";
