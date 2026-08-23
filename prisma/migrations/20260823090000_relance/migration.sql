-- Date de la dernière relance après absence. Sans elle, la relance repartirait
-- chaque jour à quelqu'un qui a choisi de ne pas revenir.
ALTER TABLE "User" ADD COLUMN "relanceLe" TIMESTAMP(3);
