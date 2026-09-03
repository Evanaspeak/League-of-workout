-- Le social : des amis qu'on ajoute, des groupes qu'on rejoint.
--
-- Rien n'est explorable par un inconnu : une amitié se demande à un pseudo
-- qu'on connaît déjà, un groupe se rejoint par un code. C'est la conséquence
-- de la réponse 127 — personne ne modère cet espace.

-- CreateTable
CREATE TABLE IF NOT EXISTS "Amitie" (
    "id" TEXT NOT NULL,
    "demandeurId" TEXT NOT NULL,
    "receveurId" TEXT NOT NULL,
    "etat" TEXT NOT NULL DEFAULT 'attente',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepteeLe" TIMESTAMP(3),

    CONSTRAINT "Amitie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Groupe" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Groupe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MembreGroupe" (
    "id" TEXT NOT NULL,
    "groupeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'membre',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembreGroupe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Amitie_demandeurId_receveurId_key" ON "Amitie"("demandeurId", "receveurId");
CREATE INDEX IF NOT EXISTS "Amitie_receveurId_etat_idx" ON "Amitie"("receveurId", "etat");
CREATE INDEX IF NOT EXISTS "Amitie_demandeurId_etat_idx" ON "Amitie"("demandeurId", "etat");
CREATE UNIQUE INDEX IF NOT EXISTS "Groupe_code_key" ON "Groupe"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "MembreGroupe_groupeId_userId_key" ON "MembreGroupe"("groupeId", "userId");
CREATE INDEX IF NOT EXISTS "MembreGroupe_userId_idx" ON "MembreGroupe"("userId");

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "Amitie" ADD CONSTRAINT "Amitie_demandeurId_fkey" FOREIGN KEY ("demandeurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "Amitie" ADD CONSTRAINT "Amitie_receveurId_fkey" FOREIGN KEY ("receveurId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "MembreGroupe" ADD CONSTRAINT "MembreGroupe_groupeId_fkey" FOREIGN KEY ("groupeId") REFERENCES "Groupe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$
BEGIN
  ALTER TABLE "MembreGroupe" ADD CONSTRAINT "MembreGroupe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
