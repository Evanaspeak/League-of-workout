-- Une partie Riot ne peut être enregistrée qu'une fois par joueur : deux
-- onglets ouverts, un double-clic ou un renvoi réseau ne doivent pas la
-- facturer deux fois.
--
-- Les doublons éventuellement déjà présents sont retirés avant la contrainte.
-- « Game » n'a pas d'horodatage de création : on garde la ligne dont
-- l'identifiant est le plus petit, ce qui est arbitraire mais déterministe.
DELETE FROM "Game" a
USING "Game" b
WHERE a."riotMatchId" IS NOT NULL
  AND a."riotMatchId" = b."riotMatchId"
  AND a."userId" = b."userId"
  AND a."id" > b."id";

-- Les parties manuelles ont riotMatchId à NULL, que Postgres ne contraint pas
-- dans un index unique : elles restent librement dupliquables, ce qui est voulu.
CREATE UNIQUE INDEX IF NOT EXISTS "Game_userId_riotMatchId_key"
  ON "Game" ("userId", "riotMatchId");
