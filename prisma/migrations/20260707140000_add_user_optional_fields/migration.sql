-- AlterTable : infos physiques optionnelles sur le compte utilisateur
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "genre" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "age" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "poids" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "taille" INTEGER;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sportsHoursPerWeek" INTEGER;
