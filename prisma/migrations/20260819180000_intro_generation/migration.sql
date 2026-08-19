-- Génération de l'intro, par compte.
--
-- Les marques « accueil vu » et « visite faite » vivent dans le navigateur.
-- C'est suffisant au quotidien, mais rien ne permet de les révoquer depuis
-- l'extérieur : un administrateur n'a pas accès au stockage local d'autrui.
-- Ce compteur entre dans la clé sous laquelle elles sont écrites ; l'augmenter
-- les périme partout à la fois, sur tous les appareils du compte.
--
-- Ajout d'une colonne avec valeur par défaut : aucune ligne existante n'est
-- lue ni réécrite, et les comptes déjà passés par l'intro restent à 0.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "introGeneration" INTEGER NOT NULL DEFAULT 0;
