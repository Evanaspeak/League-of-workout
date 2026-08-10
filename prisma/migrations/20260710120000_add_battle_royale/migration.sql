-- AlterTable : un battle royale ne se juge ni au nombre de morts (on n'en a
-- qu'une) ni au résultat, mais au classement final. On retient donc la place
-- obtenue et la taille de la partie, qui varie selon le mode (solo, duo, squad).
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "placement" INTEGER;
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "joueurs" INTEGER;
