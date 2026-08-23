-- Fuseau horaire du navigateur, au format IANA. Il décide de l'heure à
-- laquelle une notification peut partir : le serveur ne connaît que l'UTC, et
-- « le matin » en UTC est le milieu de la nuit pour une partie du monde.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fuseau" TEXT;
