-- La première dette soldée dans l'heure. Conditionnel, comme toutes les
-- migrations de ce dossier : une base neuve se monte par elles, et une base
-- déjà à jour doit pouvoir les rejouer sans rien casser.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "paiementEclairLe" TIMESTAMP(3);
