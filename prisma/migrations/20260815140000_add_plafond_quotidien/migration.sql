-- Avertissement de volume quotidien, en points d'effort. 0 = désactivé.
-- Ce n'est pas un plafond dur : la dette continue d'être calculée, seul un
-- message signale qu'on a dépassé ce qu'on s'était fixé pour la journée.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "plafondQuotidien" INTEGER NOT NULL DEFAULT 0;
