-- Date du dernier bilan hebdomadaire. Sans elle, un travail horaire enverrait
-- le même courriel vingt-quatre fois dans la journée.
ALTER TABLE "User" ADD COLUMN "bilanLe" TIMESTAMP(3);
