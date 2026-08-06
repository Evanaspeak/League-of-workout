-- AlterTable : plusieurs exercices peuvent désormais être sélectionnés et
-- tournent à tour de rôle d'une partie à l'autre.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "exercices" TEXT[] NOT NULL DEFAULT ARRAY['pompes']::TEXT[];

-- Reprise du choix unique existant vers la nouvelle liste.
UPDATE "User"
SET "exercices" = ARRAY["exercice"]::TEXT[]
WHERE "exercice" IS NOT NULL
  AND "exercice" <> ''
  AND "exercices" = ARRAY['pompes']::TEXT[];

-- La colonne "exercice" est conservée volontairement : la supprimer ferait
-- échouer l'ancienne version du code pendant le basculement du déploiement.
