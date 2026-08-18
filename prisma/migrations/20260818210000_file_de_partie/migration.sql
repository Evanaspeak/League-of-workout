-- Type de file, lu sur le lanceur League. Le KDA seul ne distingue pas une
-- classée d'une partie normale, et l'API publique de Riot — la seule qui le
-- disait jusqu'ici — exige une clé développeur.

ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "file" TEXT;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "fileClassee" BOOLEAN;
