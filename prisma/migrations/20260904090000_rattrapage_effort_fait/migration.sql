-- Rattrapage : toute activité déjà enregistrée est réputée FAITE.
--
-- Jusqu'ici, la dette ne montait que pour les exercices comptés en temps, donc
-- une partie payée en pompes ne passait jamais par le compteur et n'écrivait
-- aucune ligne `Paiement`. Le classement, le mur des records et le niveau de
-- compte restaient vides par construction pour qui joue avec l'exercice par
-- défaut : neuf cent soixante parties enregistrées, deux points payés.
--
-- Décision du propriétaire du produit : ce qui a déjà été enregistré a été
-- fait. On écrit donc le paiement correspondant, daté du JOUR DE LA PARTIE —
-- pas d'aujourd'hui, sans quoi une seule journée porterait des mois d'effort
-- et le mur des records n'aurait plus aucun sens.
--
-- On ne rattrape QUE la part qui n'était pas comptée en temps. La part en
-- temps, elle, avait déjà son chemin par le compteur : la reprendre ici la
-- paierait une seconde fois.
--
-- **Idempotent par construction, et pas par précaution.** Le jeton dérive de
-- l'identifiant de la partie et il est unique en base : un second passage ne
-- peut rien insérer. C'est ce qui rend cette migration rejouable sur une base
-- déjà rattrapée, et sans effet sur une base neuve où il n'y a aucune partie.
INSERT INTO "Paiement" ("id", "userId", "points", "jour", "jeton", "createdAt")
SELECT
  'rat_' || g."id",
  g."userId",
  points.valeur,
  to_char(g."date" AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
  'rat_' || g."id",
  now()
FROM "Game" g
CROSS JOIN LATERAL (
  SELECT CASE
    -- Un seul exercice concerné : `exercice` suffit, `repartition` est nulle.
    WHEN g."repartition" IS NULL THEN
      CASE WHEN g."exercice" IN ('boxe', 'planche') THEN 0 ELSE g."pompesCalculees" END
    -- Ventilé entre plusieurs : on somme tout sauf ce qui se compte en temps.
    ELSE COALESCE((
      SELECT SUM((e.value)::numeric)
      FROM jsonb_each_text(g."repartition"::jsonb) AS e(key, value)
      WHERE e.key NOT IN ('boxe', 'planche')
    ), 0)
  END AS valeur
) AS points
-- Une partie sans enjeu n'a rien coûté : elle n'a rien à acquitter.
WHERE g."sansEnjeu" = false
  AND points.valeur > 0
ON CONFLICT ("jeton") DO NOTHING;
