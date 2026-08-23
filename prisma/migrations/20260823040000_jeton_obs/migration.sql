-- Jeton de la source de diffusion.
--
-- Un logiciel de diffusion n'a pas de session : la page qui affiche la dette
-- en direct s'identifie donc par une adresse secrète. Elle est nulle tant que
-- personne ne l'a demandée, et unique pour qu'une régénération invalide
-- réellement l'ancienne.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jetonObs" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_jetonObs_key" ON "User"("jetonObs");
