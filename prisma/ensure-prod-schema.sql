-- ════════════════════════════════════════════════════════════════════════
-- ENSURE PROD SCHEMA — script idempotent (non destructif)
-- À exécuter dans l'éditeur SQL de la base de production (Neon / Supabase).
-- Synchronise les colonnes/tables ajoutées au schéma mais potentiellement
-- absentes de la base de prod (cause probable des erreurs de connexion + admin).
-- Toutes les opérations sont "IF NOT EXISTS" → réexécutables sans risque.
-- ════════════════════════════════════════════════════════════════════════

-- ── Colonnes ajoutées au modèle User lors du passage SQLite → Postgres ──────
-- (lues par l'adapter Auth.js à chaque connexion OAuth, et par /admin)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email"         TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name"          TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "image"         TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordHash"  TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "betaRank"      INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- ── Tables Auth.js (OAuth) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Account" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "type"              TEXT NOT NULL,
    "provider"          TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token"     TEXT,
    "access_token"      TEXT,
    "expires_at"        INTEGER,
    "token_type"        TEXT,
    "scope"             TEXT,
    "id_token"          TEXT,
    "session_state"     TEXT,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Account_provider_providerAccountId_key"
    ON "Account"("provider", "providerAccountId");

CREATE TABLE IF NOT EXISTS "Session" (
    "id"           TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId"       TEXT NOT NULL,
    "expires"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Session_sessionToken_key" ON "Session"("sessionToken");

CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "expires"    TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_identifier_token_key"
    ON "VerificationToken"("identifier", "token");

-- ── Tables config / admin ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "SystemConfig" (
    "key"   TEXT NOT NULL,
    "value" TEXT NOT NULL,
    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- ── Table candidatures bêta ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "BetaApplication" (
    "id"                 TEXT NOT NULL,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pseudo"             TEXT NOT NULL,
    "email"              TEXT NOT NULL,
    "riotId"             TEXT NOT NULL,
    "region"             TEXT NOT NULL,
    "genre"              TEXT NOT NULL,
    "age"                INTEGER NOT NULL,
    "poids"              INTEGER NOT NULL,
    "hoursPerWeek"       TEXT NOT NULL,
    "sportsHoursPerWeek" INTEGER NOT NULL DEFAULT 0,
    "currentSport"       TEXT,
    "motivation"         TEXT NOT NULL,
    "discovery"          TEXT NOT NULL,
    "engagement"         INTEGER NOT NULL,
    "status"             TEXT NOT NULL DEFAULT 'pending',
    CONSTRAINT "BetaApplication_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BetaApplication_email_key" ON "BetaApplication"("email");
ALTER TABLE "BetaApplication" ADD COLUMN IF NOT EXISTS "sportsHoursPerWeek" INTEGER NOT NULL DEFAULT 0;
