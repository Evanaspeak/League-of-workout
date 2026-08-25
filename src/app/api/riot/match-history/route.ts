import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lireResultat, type MotifSansResultat } from "@/lib/riotResultat";
import { detectRole } from "@/lib/riot-role";
import { getCurrentUser } from "@/lib/auth-helpers";
import { routageDe, validerPuuid } from "@/lib/riot-champs";
import { COUT, messageRefus, rendreAuBudget, reserverRiot } from "@/lib/riotBudget";
import { refusRiot } from "@/lib/riotStatut";
import { riotFetch } from "@/lib/riotFetch";

/** Espacement entre deux paquets de requêtes, pour ne pas saturer la clé. */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const dynamic = "force-dynamic";



// Données de match déjà traitées, gardées en mémoire pour éviter de
// re-frapper l'API Riot à chaque visite de la page (cause des 429).
type CachedMatch = {
  champion: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  /**
   * `null` quand le résultat ne se lit pas : remake, ou deux sources qui se
   * contredisent. Ce n'est pas une défaite, et la partie ne doit pas
   * s'ajouter dans cet état.
   */
  resultat: "V" | "D" | null;
  motif?: MotifSansResultat;
  date: string;
};
const matchCache = new Map<string, CachedMatch>();


export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  // Le PUUID vient de la base, mais rien ne garantissait ce qu'on y avait
  // écrit : il partait brut dans l'URL et un dièse suffisait à s'approprier le
  // chemin comme la requête envoyés sous la clé du serveur. Un compte dont le
  // PUUID est mal formé se voit renvoyé vers ses réglages, comme un compte qui
  // n'en a pas — c'est le même remède.
  const puuid = validerPuuid(user.riotPuuid);
  if (!puuid) {
    return NextResponse.json({ error: "PUUID manquant. Configure ton Riot ID dans Réglages." }, { status: 400 });
  }

  const apiKey = process.env.RIOT_API_KEY;
  if (!apiKey) {
    // 503 et non 500 : ce n'est pas Riot qui est muet, c'est nous qui ne
    // sommes pas prêts. Le journal de synchronisation distingue les deux, et
    // sans ça il aurait imputé à Riot une case vide de notre côté.
    return NextResponse.json({ error: "Le suivi Riot est indisponible pour le moment. Le reste de l'application fonctionne : tes parties s'enregistrent à la main." }, { status: 503 });
  }

  const routing = routageDe(user.riotRegion);

  /**
   * La réservation est posée avant le premier appel, pas après.
   *
   * Vingt et une requêtes sur une clé qui en autorise cent par deux minutes :
   * cinq ouvertures d'historique simultanées la vident. Réserver après coup
   * laisserait partir tous les appels concurrents, chacun ayant vu du budget
   * libre — et la reprise automatique de `riotFetch` doublerait la charge
   * exactement quand elle est déjà trop haute.
   */
  const refus = await reserverRiot(user.id, COUT.historique);
  if (refus) {
    return NextResponse.json({ error: messageRefus(refus) }, { status: 429 });
  }
  // Ce qui n'est pas dépensé revient au budget : le cache évite le plus souvent
  // dix-neuf des vingt requêtes de détail.
  let depense = 0;

  const idsRes = await riotFetch(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=20`,
    apiKey
  );
  depense += 1;
  if (!idsRes.ok) {
    await rendreAuBudget(COUT.historique, depense);
    // Le code de Riot ne repart pas tel quel : son 401 veut dire « clé
    // refusée », le nôtre veut dire « pas de session ». Voir `riotStatut`.
    const refuseRiotLu = refusRiot(idsRes.status, "Aucune partie trouvée chez Riot.");
    return NextResponse.json({ error: refuseRiotLu.message }, { status: refuseRiotLu.statut });
  }

  const ids: string[] = await idsRes.json();
  if (!ids.length) {
    await rendreAuBudget(COUT.historique, depense);
    return NextResponse.json([]);
  }

  const logged = await prisma.game.findMany({
    where: { riotMatchId: { in: ids }, userId: user.id },
    select: { riotMatchId: true, pompesCalculees: true, exercice: true },
  });
  const loggedMap = new Map(logged.map((g) => [g.riotMatchId, g]));

  // Clé de cache propre au joueur : les données mises en cache (champion, KDA…)
  // dépendent du participant, donc du puuid. Sinon deux joueurs d'une même
  // partie liraient les stats de l'autre.
  const cacheKey = (id: string) => `${puuid}:${id}`;

  // On ne récupère sur Riot que les matchs absents du cache.
  const missing = ids.filter((id) => !matchCache.has(cacheKey(id)));
  const BATCH = 4;

  for (let i = 0; i < missing.length; i += BATCH) {
    if (i > 0) await sleep(300);
    const batch = missing.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (id) => {
        try {
          depense += 1;
          const res = await riotFetch(
            `https://${routing}.api.riotgames.com/lol/match/v5/matches/${id}`,
            apiKey
          );
          if (!res.ok) return;

          const match = await res.json();
          if (!match?.info?.participants) return;

          const participant = match.info.participants.find((p: { puuid: string }) => p.puuid === puuid);
          if (!participant) return;

          const role = detectRole(match.info, participant);

          const ts = match.info.gameEndTimestamp ?? match.info.gameCreation ?? Date.now();
          matchCache.set(cacheKey(id), {
            champion: (participant.championName as string) ?? "?",
            role,
            kills: (participant.kills as number) ?? 0,
            deaths: (participant.deaths as number) ?? 0,
            assists: (participant.assists as number) ?? 0,
            // Le résultat se lit par recoupement, et peut ne pas se lire du
            // tout : un remake n'est pas une défaite, et deux sources qui se
            // contredisent ne se tranchent pas au hasard. Voir
            // `src/lib/riotResultat.ts`.
            ...lireResultat(match.info, participant),
            date: new Date(ts).toISOString(),
          });
        } catch {
          // ignoré : le match restera marqué indisponible ci-dessous
        }
      })
    );
  }

  // On renvoie les matchs dans l'ordre Riot ; un match non récupéré
  // (erreur persistante) est marqué pour rester visible.
  const results = ids.map((id) => {
    const c = matchCache.get(cacheKey(id));
    const alreadyLogged = loggedMap.has(id);
    if (!c) {
      return { matchId: id, champion: "?", role: "?", kills: 0, deaths: 0, assists: 0,
        result: "?", motifResultat: null, date: new Date().toISOString(),
        alreadyLogged, pompesCalculees: null, exercice: null, indisponible: true };
    }
    return {
      matchId: id,
      champion: c.champion,
      role: c.role,
      kills: c.kills,
      deaths: c.deaths,
      assists: c.assists,
      result: c.resultat ?? "?",
      // Une partie dont le résultat ne se lit pas se présente comme
      // inajoutable, au même titre qu'une partie que Riot n'a pas rendue :
      // l'ajouter demanderait de choisir un camp au hasard.
      motifResultat: c.motif ?? null,
      date: c.date,
      alreadyLogged,
      pompesCalculees: alreadyLogged ? loggedMap.get(id)?.pompesCalculees ?? null : null,
      // Exercice réellement enregistré pour cette partie, pour l'afficher dans
      // sa propre unité plutôt que dans l'exercice courant.
      exercice: alreadyLogged ? loggedMap.get(id)?.exercice ?? null : null,
      indisponible: c.resultat === null,
    };
  });

  await rendreAuBudget(COUT.historique, depense);
  return NextResponse.json(results);
}
