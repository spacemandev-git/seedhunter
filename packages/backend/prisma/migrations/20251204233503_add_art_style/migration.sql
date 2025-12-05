-- Migration: Add art_style column to players table
-- This migration adds support for art style variants (lowpoly or popart) for founder cards

-- Add art_style column to players table
ALTER TABLE players ADD COLUMN art_style VARCHAR(20);

-- Add index for faster queries (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_players_art_style ON players(art_style);

-- Note: When running this migration, you may want to populate existing players with random art styles:
-- UPDATE players SET art_style = CASE WHEN RANDOM() < 0.5 THEN 'lowpoly' ELSE 'popart' END WHERE art_style IS NULL;
