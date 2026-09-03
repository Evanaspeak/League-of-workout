-- Que faire quand un jeu démarre : demander, lancer seul, ou ne rien faire.
--
-- Conditionnelle, comme toutes les migrations de ce dépôt : elles doivent
-- pouvoir se rejouer sur une base déjà à jour (voir `migrationsRejouables`).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionAuto" TEXT NOT NULL DEFAULT 'demander';
