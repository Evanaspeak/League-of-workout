-- Le plafond de trois notifications par semaine (réponse 103) a besoin d'un
-- compte sur une fenêtre glissante, que les marques par type ne donnent pas.
--
-- Conditionnelle comme toutes les migrations de ce dépôt : le socle peut
-- l'avoir déjà créée, et `src/migrationsRejouables.test.ts` refuse une création
-- inconditionnelle.
CREATE TABLE IF NOT EXISTS "EnvoiPush" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "quand" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EnvoiPush_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EnvoiPush_userId_quand_idx" ON "EnvoiPush"("userId", "quand");

DO $$ BEGIN
    ALTER TABLE "EnvoiPush" ADD CONSTRAINT "EnvoiPush_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
