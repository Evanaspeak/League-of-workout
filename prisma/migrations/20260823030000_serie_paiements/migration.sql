-- Historique des paiements de dette, et date de début de la dette courante.
--
-- Le compteur `dettePointsDus` ne dit que l'état présent. Sans trace de ce qui
-- a été payé, ni une série de jours consécutifs ni un état « en retard depuis
-- trois jours » ne se calculent.
CREATE TABLE IF NOT EXISTS "Paiement" (
    "id"        TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId"    TEXT NOT NULL,
    "points"    INTEGER NOT NULL,
    -- Jour local, au format AAAA-MM-JJ : le jour UTC ferait basculer une série
    -- d'un jour sur l'autre selon le fuseau de la personne.
    "jour"      TEXT NOT NULL,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Paiement_userId_jour_idx" ON "Paiement"("userId", "jour");

ALTER TABLE "Paiement" DROP CONSTRAINT IF EXISTS "Paiement_userId_fkey";
ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "detteDepuis" TIMESTAMP(3);
