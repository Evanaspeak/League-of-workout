import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { lireResultat } from "@/lib/riotResultat";
import { detectRole } from "@/lib/riot-role";
import { getCurrentUser } from "@/lib/auth-helpers";
import { routageDe, validerPuuid } from "@/lib/riot-champs";
import { COUT, messageRefus, reserverRiot } from "@/lib/riotBudget";
import { refusRiot } from "@/lib/riotStatut";
import { riotFetch } from "@/lib/riotFetch";

export const dynamic = "force-dynamic";




export async function GET(req: Request) {
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
   * Deux requêtes à chaque tour. Le mode session appelle cette route toutes les
   * deux minutes, et la clé de développement en autorise cent par deux minutes :
   * cinquante joueurs simultanés en font le tour, sans que personne n'ait rien
   * fait d'anormal. Le refus vaut mieux que le 429 en cascade.
   */
  const refus = await reserverRiot(user.id, COUT.dernierePartie);
  if (refus) {
    return NextResponse.json({ error: messageRefus(refus) }, { status: 429 });
  }

  const idsRes = await riotFetch(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids?start=0&count=1`,
    apiKey
  );
  if (!idsRes.ok) {
    // Le code de Riot ne repart pas tel quel : son 401 veut dire « clé
    // refuseRiotLue », le nôtre veut dire « pas de session ». Voir `riotStatut`.
    const refuseRiotLu = refusRiot(idsRes.status, "Aucune game trouvée.");
    return NextResponse.json({ error: refuseRiotLu.message }, { status: refuseRiotLu.statut });
  }

  const ids: string[] = await idsRes.json();
  if (!ids.length) {
    return NextResponse.json({ error: "Aucune game trouvée." }, { status: 404 });
  }

  // Mode "peek" : renvoie juste l'ID de la dernière game, sans la logger.
  // Sert à fixer un point de départ au démarrage d'une session.
  const peek = new URL(req.url).searchParams.get("peek");
  if (peek) {
    return NextResponse.json({ matchId: ids[0] });
  }

  const alreadyLogged = await prisma.game.findFirst({ where: { riotMatchId: ids[0], userId: user.id } });
  if (alreadyLogged) {
    return NextResponse.json({ error: "Cette game est déjà loggée." }, { status: 409 });
  }

  const matchRes = await riotFetch(
    `https://${routing}.api.riotgames.com/lol/match/v5/matches/${ids[0]}`,
    apiKey
  );
  if (!matchRes.ok) {
    const refuseRiotLu = refusRiot(matchRes.status, "Cette partie n'est plus disponible chez Riot.");
    return NextResponse.json({ error: refuseRiotLu.message }, { status: refuseRiotLu.statut });
  }

  const match = await matchRes.json();
  const queueId: number = match.info.queueId;
  const participant = match.info.participants.find((p: { puuid: string }) => p.puuid === puuid);

  if (!participant) {
    return NextResponse.json({ error: "Participant non trouvé dans le match." }, { status: 404 });
  }

  const role = detectRole(match.info, participant);

  /**
   * Un résultat illisible n'est pas une défaite.
   *
   * C'est le chemin que la session automatique emprunte après chaque partie :
   * une supposition ici s'enregistre toute seule, et se paie en dette. Un
   * remake, ou deux sources qui se contredisent, valent mieux d'être refuseRiotLus
   * que d'être devinés.
   */
  const lu = lireResultat(match.info, participant);
  if (lu.resultat === null) {
    return NextResponse.json(
      { error: "Résultat de la partie illisible", motif: lu.motif },
      // 422 et non 409 : dans cette route le 409 dit déjà « cette partie est
      // déjà enregistrée ». Deux sens sur un même code rendraient le journal
      // de synchronisation incapable de les distinguer.
      { status: 422 },
    );
  }

  return NextResponse.json({
    matchId: ids[0],
    champion: participant.championName,
    role,
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    result: lu.resultat,
    queueId,
  });
}
