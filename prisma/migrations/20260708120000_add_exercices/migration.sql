-- AlterTable : exercice choisi par l'utilisateur + seuil de rappel en session
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "exercice" TEXT NOT NULL DEFAULT 'pompes';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rappelSeuilPoints" INTEGER NOT NULL DEFAULT 45;

-- AlterTable : chaque partie mémorise l'exercice avec lequel elle a été jouée,
-- pour que l'historique reste fidèle si l'utilisateur change d'exercice.
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "exercice" TEXT NOT NULL DEFAULT 'pompes';
