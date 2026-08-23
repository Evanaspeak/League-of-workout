-- Jeton d'unicité des paiements rejoués depuis la file hors ligne.
-- Idempotent : le socle peut déjà l'avoir créé sur une base neuve.
ALTER TABLE "Paiement" ADD COLUMN IF NOT EXISTS "jeton" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Paiement_jeton_key" ON "Paiement"("jeton");
