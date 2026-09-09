-- Ce qu'une montre a mesuré comme dépense sur une journée (réponse 040).
--
-- `IF NOT EXISTS` partout : le socle et les migrations de ce dépôt doivent
-- pouvoir se rejouer sur une base déjà à jour, et `src/migrationsRejouables.test.ts`
-- le refuse autrement.
CREATE TABLE IF NOT EXISTS "DepenseJour" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jour" TEXT NOT NULL,
    "kcalBrulees" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepenseJour_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DepenseJour_userId_jour_key" ON "DepenseJour"("userId", "jour");
CREATE INDEX IF NOT EXISTS "DepenseJour_userId_jour_idx" ON "DepenseJour"("userId", "jour");

DO $$ BEGIN
  ALTER TABLE "DepenseJour" ADD CONSTRAINT "DepenseJour_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
