-- Date de la dernière relance après absence. Sans elle, la relance repartirait
-- chaque jour à quelqu'un qui a choisi de ne pas revenir.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "relanceLe" TIMESTAMP(3);
