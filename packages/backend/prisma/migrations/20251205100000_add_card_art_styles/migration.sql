-- CreateTable: card_art_styles
-- Art style is now stored per card (gridIndex) instead of per player
-- This ensures art style persists through trades

CREATE TABLE "card_art_styles" (
    "grid_index" INTEGER NOT NULL,
    "art_style" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_art_styles_pkey" PRIMARY KEY ("grid_index")
);

-- Migrate existing art styles from players to the card_art_styles table
-- This preserves the art style for cards that players currently own
INSERT INTO "card_art_styles" ("grid_index", "art_style", "created_at")
SELECT DISTINCT p."grid_index", p."art_style", NOW()
FROM "players" p
WHERE p."grid_index" IS NOT NULL 
  AND p."art_style" IS NOT NULL
ON CONFLICT ("grid_index") DO NOTHING;
