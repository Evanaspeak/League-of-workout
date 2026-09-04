-- Le mur des records ouvert à tous, ou au seul cercle. Défaut : le cercle.
-- Conditionnel, comme toutes les migrations de ce dossier.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "recordsPublics" BOOLEAN NOT NULL DEFAULT false;
