-- Exercices mis de côté pour blessure ou gêne.
--
-- Ils sortent de `exercices`, la liste active que tout le reste lit déjà, et
-- attendent ici. Ce choix évite de modifier les six endroits qui répartissent
-- la dette, et donc d'en oublier un.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "exercicesSuspendus" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "suspensionDepuis" TIMESTAMP(3);
