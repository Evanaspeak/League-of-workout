-- Gèle le barème des exercices sur la partie.
--
-- Sans elle, changer le prix d'une seconde de boxe réécrivait le coût de
-- toutes les parties déjà enregistrées : un effort déjà fourni cessait de
-- correspondre à ce qu'on avait payé.
--
-- Conditionnelle, comme toutes les migrations de ce dépôt : elles doivent
-- pouvoir se rejouer sur une base déjà à jour (voir `migrationsRejouables`).
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "ratios" TEXT;

-- Les parties déjà enregistrées reçoivent le barème EN VIGUEUR, et pas les
-- ratios d'origine.
--
-- La raison est que les points, eux, n'ont jamais dépendu du barème :
-- `pompesCalculees` est un coût en points d'effort, et le ratio ne sert qu'à
-- l'afficher. Ce qu'on gèle ici, c'est donc l'AFFICHAGE — et l'affichage
-- qu'une partie ancienne a aujourd'hui est celui du barème courant. Y écrire
-- les ratios d'origine changerait le passé au lieu de l'arrêter, ce qui est
-- exactement l'inverse du but.
--
-- Sans ligne de configuration, aucun barème n'a jamais été posé : la colonne
-- reste nulle et la lecture retombe sur les ratios d'origine, qui sont bien
-- ceux qui étaient affichés.
UPDATE "Game" g
   SET "ratios" = c."value"
  FROM "SystemConfig" c
 WHERE c."key" = 'exercices'
   AND g."ratios" IS NULL;
