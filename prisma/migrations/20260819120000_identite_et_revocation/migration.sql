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

-- 0. Refuser tôt, et en français, si deux comptes ne diffèrent que par la
--    casse. Sans ce garde-fou, l'étape 1 se heurte à l'index unique existant
--    et la migration s'arrête sur une violation de contrainte brute, sans dire
--    QUELLES adresses posent problème. Le déploiement échoue dans les deux
--    cas — la version en ligne reste servie — mais ici le message désigne les
--    comptes à fusionner à la main avant de relancer.
DO $$
DECLARE
  fautives text;
BEGIN
  SELECT string_agg(cle, ', ')
    INTO fautives
    FROM (
      SELECT lower(trim("email")) AS cle
        FROM "User"
       WHERE "email" IS NOT NULL
       GROUP BY 1
      HAVING count(*) > 1
    ) AS d;

  IF fautives IS NOT NULL THEN
    RAISE EXCEPTION
      'Plusieurs comptes partagent la même adresse à la casse près : %. Fusionnez-les avant de rejouer cette migration.',
      fautives;
  END IF;
END
$$;

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
