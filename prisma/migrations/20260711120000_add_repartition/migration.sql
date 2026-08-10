-- AlterTable : quand plusieurs exercices sont retenus, la dette d'une partie se
-- partage entre eux au lieu d'alterner d'une partie à l'autre. On stocke la
-- ventilation, la colonne `pompesCalculees` restant le total.
-- Exemple : {"pompes":23,"boxe":23}
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "repartition" TEXT;
