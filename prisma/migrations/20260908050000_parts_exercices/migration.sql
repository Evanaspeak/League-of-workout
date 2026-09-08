-- Le partage entre exercices au choix (réponse 068) : un poids par exercice,
-- en JSON. Nulle vaut « poids 1 partout », donc le partage à parts égales.
-- Conditionnelle comme toutes les migrations de ce dépôt.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "partsExercices" TEXT;
