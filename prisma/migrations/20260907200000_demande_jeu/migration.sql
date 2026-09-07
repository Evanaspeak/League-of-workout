-- Un jeu qu'on nous demande d'ajouter (réponse 180).
-- Conditionnelle comme toutes les migrations de ce dépôt : une base neuve la
-- monte, une base déjà à jour la traverse sans rien faire.
CREATE TABLE IF NOT EXISTS "DemandeJeu" (
  "id"     TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "nom"    TEXT NOT NULL,
  "cle"    TEXT NOT NULL,
  "quand"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DemandeJeu_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DemandeJeu_userId_cle_key" ON "DemandeJeu"("userId", "cle");
CREATE INDEX IF NOT EXISTS "DemandeJeu_cle_idx" ON "DemandeJeu"("cle");

DO $$ BEGIN
  ALTER TABLE "DemandeJeu" ADD CONSTRAINT "DemandeJeu_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
