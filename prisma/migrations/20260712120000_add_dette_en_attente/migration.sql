-- AlterTable : dette accumulée mais pas encore faite, en points d'effort. Elle
-- monte à chaque partie enregistrée et retombe quand l'utilisateur va la payer.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dettePointsDus" INTEGER NOT NULL DEFAULT 0;
-- Seuil de rappel, en SECONDES d'effort : c'est la seule unité comparable
-- entre des pompes, des squats et de la boxe. 300 s = 5 min.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rappelSeuilSec" INTEGER NOT NULL DEFAULT 300;
