-- AlterTable : chaque partie retient le jeu concerné et la façon dont il
-- génère de la dette (résultat de partie, ou temps passé à jouer).
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "jeu" TEXT NOT NULL DEFAULT 'League of Legends';
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "typeJeu" TEXT NOT NULL DEFAULT 'parties';
-- Durée jouée en secondes, uniquement pour les jeux comptés au temps.
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "dureeSec" INTEGER;
