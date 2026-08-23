-- Signalements de problèmes envoyés depuis l'application.
--
-- `userId` est nullable et se met à NULL à la suppression du compte : un
-- signalement utile ne doit pas disparaître avec le compte qui l'a envoyé,
-- et ne doit pas non plus le retenir en base après son effacement.
CREATE TABLE IF NOT EXISTS "Signalement" (
    "id"        TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId"    TEXT,
    "message"   TEXT NOT NULL,
    "page"      TEXT NOT NULL,
    "contexte"  TEXT NOT NULL,
    "statut"    TEXT NOT NULL DEFAULT 'ouvert',

    CONSTRAINT "Signalement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Signalement_statut_createdAt_idx"
    ON "Signalement"("statut", "createdAt");

ALTER TABLE "Signalement" DROP CONSTRAINT IF EXISTS "Signalement_userId_fkey";
ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
