-- Le nom montré aux autres : « pseudo » ou « riot » (réponse 128, « au choix »).
--
-- Le défaut est le pseudo interne : le pseudo Riot relie un compte d'ici à une
-- identité extérieure, et personne ne doit se mettre à le publier parce qu'on
-- a ajouté un réglage.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "nomAffiche" TEXT NOT NULL DEFAULT 'pseudo';
