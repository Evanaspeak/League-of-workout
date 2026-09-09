-- Porte-t-elle une montre ou un bracelet connecté ? (réponse 035)
--
-- NULLABLE et sans défaut, à dessein : les comptes qui existent déjà n'ont
-- jamais eu la question, et un défaut à `false` les ferait tous passer pour
-- des gens qui ont répondu non.
--
-- `IF NOT EXISTS` : le socle et les migrations de ce dépôt doivent pouvoir se
-- rejouer sur une base déjà à jour, et `src/migrationsRejouables.test.ts` le
-- refuse autrement.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "montre" BOOLEAN;
