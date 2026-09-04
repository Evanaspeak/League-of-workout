-- Le corps et les calories (étape 05 du plan).
--
-- Tout est ÉTEINT au départ : la réponse 013 dit « une option qu'on active ».
-- Aucune colonne n'a de valeur par défaut qui allume quoi que ce soit, et
-- `rappelPeseeActif` est faux — un réglage ajouté ne doit jamais se mettre à
-- faire quelque chose pour quelqu'un qui n'a rien demandé.
--
-- Conditionnel, comme toutes les migrations de ce dépôt : une base neuve se
-- construit depuis `prisma/migrations`, et une base déjà à jour ne doit rien
-- avoir à faire ici.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "formuleCalorique" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "niveauActivite" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "modeCalorique" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "poidsCible" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tourTaille" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tourCou" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tourHanches" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rappelPeseeActif" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rappelPeseeLe" TIMESTAMP(3);

-- Une pesée, un jour. Le poids est en GRAMMES et la colonne le dit : quelqu'un
-- qui se pèse à 78,4 kg doit pouvoir l'écrire, et `User.poids`, en kilos
-- entiers, le perdrait. Deux unités sous un même nom sont le malentendu qui a
-- coûté une soirée sur le mot « activité ».
CREATE TABLE IF NOT EXISTS "Pesee" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jour" TEXT NOT NULL,
    "grammes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pesee_pkey" PRIMARY KEY ("id")
);

-- Une pesée par jour au maximum, posée EN BASE. Se peser deux fois dans la
-- journée est courant ; sans cette contrainte, un double clic fabriquerait deux
-- points sur la courbe et rien ne le dirait.
CREATE UNIQUE INDEX IF NOT EXISTS "Pesee_userId_jour_key" ON "Pesee"("userId", "jour");
CREATE INDEX IF NOT EXISTS "Pesee_userId_jour_idx" ON "Pesee"("userId", "jour");

DO $$
BEGIN
    ALTER TABLE "Pesee" ADD CONSTRAINT "Pesee_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
