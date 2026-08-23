-- ════════════════════════════════════════════════════════════════════════════
-- Le socle : ce qui existait avant que ce dossier existe.
--
-- Le schéma d'origine a été poussé sur Neon avant qu'il y ait des migrations.
-- Aucune migration ne créait donc « User », « Game » ni « Goal », et sur une
-- base vide `prisma migrate deploy` échouait à la cinquième en annonçant
-- « relation "User" does not exist ». Ça ne se voyait pas en production, dont
-- la base est antérieure. Ça se serait vu le jour d'une reprise après
-- sinistre, c'est-à-dire le pire jour possible.
--
-- Tout ici est CONDITIONNEL, et c'est ce qui rend le rattrapage possible :
--   * sur une base vide, ce fichier crée l'ensemble du schéma, et les trente-
--     deux migrations suivantes n'ont plus rien à faire (elles sont toutes
--     écrites en « IF NOT EXISTS ») ;
--   * sur la base de production, où tout existe déjà, il ne fait rien du tout.
--
-- Il se régénère avec :
--   npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script
-- puis en rendant chaque création conditionnelle. Ne pas l'écrire à la main.
-- ════════════════════════════════════════════════════════════════════════════

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "pseudo" TEXT NOT NULL DEFAULT 'Joueur',
    "riotId" TEXT,
    "riotPuuid" TEXT,
    "riotRegion" TEXT NOT NULL DEFAULT 'EUW1',
    "gainageMaxSec" INTEGER NOT NULL DEFAULT 45,
    "passwordHash" TEXT,
    "sessionEpoch" INTEGER NOT NULL DEFAULT 0,
    "introGeneration" INTEGER NOT NULL DEFAULT 0,
    "genre" TEXT,
    "age" INTEGER,
    "poids" INTEGER,
    "taille" INTEGER,
    "sportsHoursPerWeek" INTEGER,
    "santeConsentiLe" TIMESTAMP(3),
    "santeRefuseLe" TIMESTAMP(3),
    "detteDepuis" TIMESTAMP(3),
    "jetonObs" TEXT,
    "exercicesSuspendus" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "suspensionDepuis" TIMESTAMP(3),
    "langue" TEXT,
    "bilanActif" BOOLEAN NOT NULL DEFAULT true,
    "bilanLe" TIMESTAMP(3),
    "relanceLe" TIMESTAMP(3),
    "fuseau" TEXT,
    "variantePompes" TEXT,
    "exercice" TEXT NOT NULL DEFAULT 'pompes',
    "exercices" TEXT[] DEFAULT ARRAY['pompes']::TEXT[],
    "rappelSeuilPoints" INTEGER NOT NULL DEFAULT 45,
    "dettePointsDus" INTEGER NOT NULL DEFAULT 0,
    "rappelSeuilSec" INTEGER NOT NULL DEFAULT 300,
    "plafondQuotidien" INTEGER NOT NULL DEFAULT 0,
    "pompesMax" INTEGER NOT NULL DEFAULT 0,
    "pompesMaxLe" TIMESTAMP(3),
    "betaRank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LoginAttempt" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Game" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" TEXT NOT NULL,
    "champion" TEXT,
    "kills" INTEGER NOT NULL,
    "deaths" INTEGER NOT NULL,
    "assists" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "gainageSec" INTEGER NOT NULL,
    "niveauCalcule" INTEGER NOT NULL,
    "partiesAvantCalcule" INTEGER NOT NULL,
    "surchargeCalculee" DOUBLE PRECISION NOT NULL,
    "scoreCalcule" INTEGER NOT NULL,
    "malusCalcule" INTEGER NOT NULL,
    "pompesCalculees" INTEGER NOT NULL,
    "exercice" TEXT NOT NULL DEFAULT 'pompes',
    "repartition" TEXT,
    "variante" TEXT,
    "jeu" TEXT NOT NULL DEFAULT 'League of Legends',
    "typeJeu" TEXT NOT NULL DEFAULT 'parties',
    "dureeSec" INTEGER,
    "placement" INTEGER,
    "joueurs" INTEGER,
    "arrets" INTEGER,
    "file" TEXT,
    "fileClassee" BOOLEAN,
    "source" TEXT NOT NULL DEFAULT 'manuel',
    "riotMatchId" TEXT,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Goal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "objectifTotalPompes" INTEGER NOT NULL DEFAULT 1000,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RoleWeight" (
    "role" TEXT NOT NULL,
    "poidsMort" DOUBLE PRECISION NOT NULL,
    "poidsKill" DOUBLE PRECISION NOT NULL,
    "poidsAssist" DOUBLE PRECISION NOT NULL,
    "maitriseActive" BOOLEAN NOT NULL,

    CONSTRAINT "RoleWeight_pkey" PRIMARY KEY ("role")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "LevelConfig" (
    "niveau" INTEGER NOT NULL,
    "seuilGainageSec" INTEGER NOT NULL,
    "seuilPompes" INTEGER NOT NULL DEFAULT 999,
    "multiplicateur" DOUBLE PRECISION NOT NULL,
    "malusDefaite" INTEGER NOT NULL,

    CONSTRAINT "LevelConfig_pkey" PRIMARY KEY ("niveau")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MasteryConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "surchargeMax" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "partiesPourMax" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "MasteryConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Paiement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "jour" TEXT NOT NULL,

    CONSTRAINT "Paiement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Signalement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,
    "message" TEXT NOT NULL,
    "page" TEXT NOT NULL,
    "contexte" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ouvert',

    CONSTRAINT "Signalement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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
    "sportsHoursPerWeek" INTEGER NOT NULL DEFAULT 0,
    "currentSport" TEXT,
    "motivation" TEXT NOT NULL,
    "discovery" TEXT NOT NULL,
    "engagement" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "BetaApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_jetonObs_key" ON "User"("jetonObs");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "LoginAttempt_key_kind_createdAt_idx" ON "LoginAttempt"("key", "kind", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Game_userId_idx" ON "Game"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Game_userId_riotMatchId_key" ON "Game"("userId", "riotMatchId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Goal_userId_key" ON "Goal"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Paiement_userId_jour_idx" ON "Paiement"("userId", "jour");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Signalement_statut_createdAt_idx" ON "Signalement"("statut", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "BetaApplication_email_key" ON "BetaApplication"("email");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "Game" ADD CONSTRAINT "Game_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "Goal" ADD CONSTRAINT "Goal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "Paiement" ADD CONSTRAINT "Paiement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "Signalement" ADD CONSTRAINT "Signalement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

