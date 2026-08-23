-- Variante d'exécution des pompes : "genoux" pour genoux au sol, NULL sinon.
-- Nullable des deux côtés : l'absence d'annotation ne veut pas dire « pompes
-- complètes », seulement « rien de déclaré ». Les parties déjà enregistrées
-- restent donc sans annotation, ce qui est exact.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "variantePompes" TEXT;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "variante" TEXT;
