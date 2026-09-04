-- Le profil public, à adresse partageable (réponse 121, « au choix »).
--
-- Nul tant que le profil n'est pas public : la présence du jeton EST le
-- réglage. Un jeton et non le pseudo, sinon on énumère les comptes qui ont
-- accepté d'être vus.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "jetonProfil" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_jetonProfil_key" ON "User"("jetonProfil");
