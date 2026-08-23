-- Langue du compte, pour les textes envoyés hors navigateur (notifications
-- push, courriels). Nullable : tant qu'aucun écran ne l'a remontée, on ne sait
-- pas, et « on ne sait pas » n'est pas « français ».
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "langue" TEXT;
