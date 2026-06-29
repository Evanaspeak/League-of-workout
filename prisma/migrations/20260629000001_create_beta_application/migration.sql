CREATE TABLE IF NOT EXISTS "BetaApplication" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pseudo" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "riotId" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "poids" INTEGER NOT NULL,
    "hoursPerWeek" TEXT NOT NULL,
    "currentSport" TEXT,
    "motivation" TEXT NOT NULL,
    "discovery" TEXT NOT NULL,
    "engagement" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "BetaApplication_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BetaApplication_email_key" ON "BetaApplication"("email");
