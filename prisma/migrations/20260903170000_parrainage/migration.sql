-- Le parrainage : un code par compte, et qui a invité qui.
--
-- Conditionnel comme toutes les migrations de ce dépôt : une base neuve se
-- construit depuis `prisma/migrations`, et une base déjà à jour doit pouvoir
-- rejouer sans rien casser.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "codeParrain" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "parrainId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_codeParrain_key" ON "User"("codeParrain");
CREATE INDEX IF NOT EXISTS "User_parrainId_idx" ON "User"("parrainId");

-- PostgreSQL n'a pas d'ADD CONSTRAINT IF NOT EXISTS : on rattrape le doublon.
DO $$ BEGIN
  ALTER TABLE "User" ADD CONSTRAINT "User_parrainId_fkey"
    FOREIGN KEY ("parrainId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
