-- Les parties jouées sans enjeu : refusées à l'écran de chargement.
--
-- Elles restent dans l'historique et sortent de tout ce qui agrège. La colonne
-- est indexée avec le compte : chaque route de statistiques la filtre, donc
-- elle figure dans le `where` le plus fréquent de la base.
ALTER TABLE "Game" ADD COLUMN IF NOT EXISTS "sansEnjeu" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Game_userId_sansEnjeu_idx" ON "Game"("userId", "sansEnjeu");
