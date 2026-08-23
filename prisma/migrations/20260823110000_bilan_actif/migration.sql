-- Recevoir ou non le bilan hebdomadaire. Vrai par défaut : le bilan est le
-- seul endroit où l'application dit ce qui a été fait plutôt que ce qui reste
-- dû. Il s'éteint d'un clic dans les réglages.
ALTER TABLE "User" ADD COLUMN "bilanActif" BOOLEAN NOT NULL DEFAULT true;
