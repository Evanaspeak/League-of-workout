-- Rocket League : les arrêts, troisième statistique positive à côté des buts
-- (stockés dans "kills") et des passes décisives (stockées dans "assists").
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "arrets" INTEGER;
