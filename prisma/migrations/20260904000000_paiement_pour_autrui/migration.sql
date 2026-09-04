-- Un paiement peut acquitter la dette de QUELQU'UN D'AUTRE.
--
-- C'est la dette commune d'une équipe (réponse 118) : `userId` dit qui a fait
-- l'effort — donc à qui le classement le compte — et `pourUserId` de quelle
-- dette il est retiré. Nul dans le cas ordinaire, qui est de payer la sienne.
--
-- Conditionnel comme toutes les migrations de ce projet : elles doivent
-- pouvoir se rejouer sur une base déjà à jour comme sur une base vide.
ALTER TABLE "Paiement" ADD COLUMN IF NOT EXISTS "pourUserId" TEXT;

CREATE INDEX IF NOT EXISTS "Paiement_pourUserId_idx" ON "Paiement"("pourUserId");

-- `SET NULL` et non `CASCADE` : le bénéficiaire peut supprimer son compte,
-- l'effort a bien été fait par quelqu'un d'autre et reste dans SON registre.
DO $$
BEGIN
  ALTER TABLE "Paiement"
    ADD CONSTRAINT "Paiement_pourUserId_fkey"
    FOREIGN KEY ("pourUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
