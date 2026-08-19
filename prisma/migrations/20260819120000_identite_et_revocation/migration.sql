-- Une adresse ne doit exister qu'une fois, quelle que soit sa casse.
--
-- L'index unique par défaut compare octet par octet : « Evan@x.com » et
-- « evan@x.com » y cohabitaient, alors que le test d'administrateur, lui,
-- compare en minuscules. De cet écart naissait une escalade de privilèges :
-- enregistrer une variante de casse de l'adresse d'un administrateur créait
-- une ligne distincte que le test reconnaissait ensuite comme administratrice.
--
-- L'ORDRE COMPTE. L'index refuse de se construire s'il reste des variantes en
-- base, et la connexion cherche désormais la forme canonique : sans cette
-- remise à plat, tout compte déjà stocké en casse mixte se retrouverait dehors.

-- 1. Ramener les adresses existantes à leur forme canonique.
UPDATE "User"
   SET "email" = lower(trim("email"))
 WHERE "email" IS NOT NULL
   AND "email" <> lower(trim("email"));

-- 2. Interdire les doublons de casse pour l'avenir. Les NULL restent distincts
--    entre eux en PostgreSQL, donc les comptes pseudo+code ne se gênent pas.
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_lower_key"
    ON "User" (lower("email"));

-- 3. Génération de session, pour pouvoir enfin révoquer un jeton.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "sessionEpoch" INTEGER NOT NULL DEFAULT 0;
