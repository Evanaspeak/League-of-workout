-- Le mode fantôme : participer aux classements sans y apparaître.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fantome" BOOLEAN NOT NULL DEFAULT false;
