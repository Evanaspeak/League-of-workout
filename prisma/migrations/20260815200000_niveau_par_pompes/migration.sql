-- Le niveau se mesure désormais en pompes d'affilée plutôt qu'en secondes de
-- gainage : la monnaie de l'application est la pompe, et tenir la planche
-- quatre minutes ne dit pas qu'on sait en faire dix.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pompesMax" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "pompesMaxLe" TIMESTAMP(3);

ALTER TABLE "LevelConfig" ADD COLUMN IF NOT EXISTS "seuilPompes" INTEGER NOT NULL DEFAULT 999;

-- Seuils par niveau : le dernier reste ouvert.
UPDATE "LevelConfig" SET "seuilPompes" = 10  WHERE "niveau" = 1;
UPDATE "LevelConfig" SET "seuilPompes" = 20  WHERE "niveau" = 2;
UPDATE "LevelConfig" SET "seuilPompes" = 35  WHERE "niveau" = 3;
UPDATE "LevelConfig" SET "seuilPompes" = 50  WHERE "niveau" = 4;
UPDATE "LevelConfig" SET "seuilPompes" = 999 WHERE "niveau" = 5;
