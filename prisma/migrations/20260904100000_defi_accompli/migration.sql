-- Un défi personnel rempli, retenu pour l'XP qu'il rapporte (réponse 139).
--
-- Des LIGNES et pas un total, exactement comme `Paiement` : l'XP se déduit par
-- somme, donc elle ne peut pas diverger de ce qui la produit.
--
-- L'unicité sur (compte, défi, période) est ce qui rend l'écriture idempotente.
-- Elle est posée EN BASE et non dans le code : deux chargements simultanés de
-- la même page liraient tous deux « pas encore retenu », et l'un des deux
-- écrirait une ligne de trop.
--
-- Conditionnel, comme toutes les migrations de ce dépôt : une base neuve se
-- construit depuis `prisma/migrations`, et une base déjà à jour ne doit rien
-- avoir à faire ici.
CREATE TABLE IF NOT EXISTS "DefiAccompli" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "periode" TEXT NOT NULL,
    "xp" INTEGER NOT NULL,

    CONSTRAINT "DefiAccompli_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DefiAccompli_userId_cle_periode_key"
    ON "DefiAccompli"("userId", "cle", "periode");

CREATE INDEX IF NOT EXISTS "DefiAccompli_userId_idx" ON "DefiAccompli"("userId");

-- PostgreSQL n'a pas d'`ADD CONSTRAINT IF NOT EXISTS` : on rattrape sa propre
-- présence plutôt que d'échouer sur une base déjà migrée.
DO $$
BEGIN
    ALTER TABLE "DefiAccompli" ADD CONSTRAINT "DefiAccompli_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
