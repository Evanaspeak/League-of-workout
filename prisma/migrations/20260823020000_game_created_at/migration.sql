-- Date d'enregistrement d'une partie, distincte de la date de la partie.
--
-- `date` se corrige à la main : une partie rattrapée le lendemain se date la
-- veille. Mesurer le délai entre l'inscription et la première partie sur ce
-- champ rendait des durées négatives.
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3);

-- Les lignes existantes reprennent leur date de partie : c'est faux pour
-- celles qui ont été rattrapées, mais infiniment moins faux que l'instant de
-- la migration, qui les daterait toutes du même jour.
UPDATE "Game" SET "createdAt" = "date" WHERE "createdAt" IS NULL;

ALTER TABLE "Game" ALTER COLUMN "createdAt" SET NOT NULL;
ALTER TABLE "Game" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP;
