-- L'histoire du test de force (ligne 152 du plan, débloquée le 8 septembre).
--
-- `User.pompesMax` ne gardait que la valeur COURANTE : il n'y avait aucune
-- histoire à montrer, et c'est exactement ce qui bloquait la ligne. Le champ
-- reste — c'est lui qui fixe le niveau — et cette table est l'HISTOIRE, comme
-- `Pesee` l'est du poids.
--
-- Conditionnel, comme toutes les migrations de ce dépôt : une base neuve se
-- construit depuis `prisma/migrations`, et une base déjà à jour ne doit rien
-- avoir à faire ici.

CREATE TABLE IF NOT EXISTS "TestForce" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jour" TEXT NOT NULL,
    "pompes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TestForce_pkey" PRIMARY KEY ("id")
);

-- Un test par jour au maximum, posé EN BASE. Refaire son test dans la même
-- journée écrase le précédent plutôt que d'ajouter un second point : deux
-- points le même jour ne disent rien d'une progression, et un double clic en
-- fabriquerait un.
CREATE UNIQUE INDEX IF NOT EXISTS "TestForce_userId_jour_key" ON "TestForce"("userId", "jour");
CREATE INDEX IF NOT EXISTS "TestForce_userId_jour_idx" ON "TestForce"("userId", "jour");

DO $$
BEGIN
    ALTER TABLE "TestForce" ADD CONSTRAINT "TestForce_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Le point qu'on a déjà, semé une fois.
--
-- Sans lui, la courbe est VIDE pour tous les comptes qui ont déjà fait le
-- test : on aurait construit la table qui répare « aucune histoire à montrer »
-- en laissant intacte l'absence d'histoire. Le propriétaire du produit est
-- dans ce cas, et c'est le seul compte qui a de la donnée.
--
-- Le jour vient de `pompesMaxLe`, qui est posé par le SERVEUR à chaque test —
-- donc en UTC. C'est une approximation d'un jour local pour qui vit loin du
-- méridien, et elle ne porte que sur ce point-ci : les suivants passent par
-- `jourLocal`. Un jour d'écart sur un point de départ ne dit rien de faux sur
-- une courbe qui se lit en semaines.
--
-- `ON CONFLICT DO NOTHING` plutôt qu'un contrôle : la migration doit pouvoir
-- se rejouer, et une ligne déjà semée n'a pas à faire échouer le déploiement.
INSERT INTO "TestForce" ("id", "userId", "jour", "pompes", "createdAt")
SELECT
    md5(random()::text || clock_timestamp()::text),
    "id",
    to_char("pompesMaxLe" AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
    "pompesMax",
    "pompesMaxLe"
FROM "User"
WHERE "pompesMax" > 0 AND "pompesMaxLe" IS NOT NULL
ON CONFLICT ("userId", "jour") DO NOTHING;
