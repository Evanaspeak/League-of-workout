-- Consentement explicite au traitement des données de santé (art. 9.2.a RGPD).
--
-- Deux dates, pas un booléen : « jamais demandé », « accepté » et « refusé »
-- sont trois états, et un consentement sans date ne se prouve pas.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "santeConsentiLe" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "santeRefuseLe"   TIMESTAMP(3);
