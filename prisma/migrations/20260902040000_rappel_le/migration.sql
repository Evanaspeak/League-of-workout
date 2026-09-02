-- Date du dernier rappel du matin envoyé.
--
-- La fenêtre d'envoi s'étend de neuf heures à midi local, faute d'un
-- déclencheur qui passe vraiment toutes les heures. Cette colonne est ce qui
-- empêche d'envoyer trois fois dans la même matinée.
--
-- `IF NOT EXISTS` comme toutes les migrations de ce dépôt : elles doivent
-- pouvoir se rejouer sur une base déjà à jour, et `src/migrationsRejouables.test.ts`
-- le refuse autrement.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "rappelLe" TIMESTAMP(3);
