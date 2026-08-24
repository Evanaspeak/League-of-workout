import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectRole } from "@/lib/riot-role";
import { getCurrentUser } from "@/lib/auth-helpers";
import { routageDe, validerPuuid } from "@/lib/riot-champs";
import { COUT, messageRefus, rendreAuBudget, reserverRiot } from "@/lib/riotBudget";

export const dynamic = "force-dynamic";


const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Données de match déjà traitées, gardées en mémoire pour éviter de
// re-frapper l'API Riot à chaque visite de la page (cause des 429).
type CachedMatch = {
  champion: string;
  role: string;
  kills: number;
  deaths: number;
  assists: number;
  result: string;
  date: string;
};
const matchCache = new Map<string, CachedMatch>();

// fetch Riot avec gestion du rate limit (429) et des erreurs serveur (5xx).
// On respecte le header Retry-After quand il est présent.
async function riotFetch(url: string, apiKey: string, tries = 4): Promise<Response> {
  let res: Response = new Response(null, { status: 500 });
  for (let attempt = 0; attempt < tries; attempt++) {
    res = await fetch(url, { headers: { "X-Riot-Token": apiKey }, cache: "no-store" });
    if (res.status === 429 || res.status >= 500) {
      if (attempt < tries - 1) {
        const retryAfter = Number(res.headers.get("Retry-After")) || (attempt + 1);
        await sleep(retryAfter * 1000);
        continue;
      }
    }
    return res;
  }
  return res;
}

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
    return NextResponse.json({ error: "Le suivi Riot est indisponible pour le moment. Le reste de l'application fonctionne : tes parties s'enregistrent à la main." }, { status: 500 });
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
    const err = await idsRes.json().catch(() => ({}));
    return NextResponse.json({ error: `Erreur Riot API: ${idsRes.status}`, details: err }, { status: idsRes.status });
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
            result: participant.win ? "V" : "D",
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
        result: "?", date: new Date().toISOString(), alreadyLogged, pompesCalculees: null, exercice: null, indisponible: true };
    }
    return {
      matchId: id,
      champion: c.champion,
      role: c.role,
      kills: c.kills,
      deaths: c.deaths,
      assists: c.assists,
      result: c.result,
      date: c.date,
      alreadyLogged,
      pompesCalculees: alreadyLogged ? loggedMap.get(id)?.pompesCalculees ?? null : null,
      // Exercice réellement enregistré pour cette partie, pour l'afficher dans
      // sa propre unité plutôt que dans l'exercice courant.
      exercice: alreadyLogged ? loggedMap.get(id)?.exercice ?? null : null,
      indisponible: false,
    };
  });

  await rendreAuBudget(COUT.historique, depense);
  return NextResponse.json(results);
}
