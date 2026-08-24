import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isRateLimited, recordAttempt } from "@/lib/rate-limit";
import { REGIONS_RIOT, routageDe, validerRiotId } from "@/lib/riot-champs";

export async function POST(req: Request) {
  // La session se vérifie AVANT de parler à Riot. Elle ne l'était qu'après,
  // pour décider s'il fallait enregistrer le résultat : l'appel sortant, lui,
  // partait dans tous les cas avec la clé du serveur. Seul le middleware
  // séparait donc Internet d'un annuaire Riot gratuit tenu à nos frais.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Cette route interroge Riot sous la clé du serveur, partagée par tous les
  // comptes. Le verrou porte donc sur le compte : relier son Riot ID est un
  // geste rare, et vingt essais par quart d'heure couvrent largement une
  // erreur de région ou de pseudo.
  if (await isRateLimited(user.id, "riot-lookup")) {
    return NextResponse.json(
      { error: "Trop de recherches d'affilée. Réessaie dans quelques minutes." },
      { status: 429 },
    );
  }
  await recordAttempt(user.id, "riot-lookup");

  // Un corps qui n'est pas du JSON, ou dont `riotId` n'est pas une chaîne,
  // faisait remonter une exception non rattrapée et répondait 500.
  const body = await req.json().catch(() => null);
  const riotId = validerRiotId(body?.riotId);
  if (!riotId) {
    return NextResponse.json({ error: "Format invalide. Utilise pseudo#tag" }, { status: 400 });
  }

  const region = typeof body?.region === "string" && REGIONS_RIOT.includes(body.region)
    ? body.region
    : null;
  if (!region) {
    return NextResponse.json({ error: "Région inconnue" }, { status: 400 });
  }

  /**
   * Sans clé, on le dit à la personne — pas au développeur.
   *
   * Le message était « Clé API Riot manquante (RIOT_API_KEY dans .env) », en
   * français quelle que soit la langue de l'écran, et il partait tel quel à
   * l'utilisateur. Il ne lui dit rien de ce qu'il peut faire, il nomme un
   * fichier qu'il ne verra jamais, et il donne à un défaut de configuration
   * l'allure d'une panne de son côté.
   *
   * C'est le cas au lancement, pas un cas de bord : la clé de production se
   * demande à Riot et met plusieurs jours à arriver.
   */
  const apiKey = process.env.RIOT_API_KEY?.trim();
  if (!apiKey) {
    // 503 et non 500 : ce n'est pas Riot qui est muet, c'est nous qui ne
    // sommes pas prêts. Le journal de synchronisation distingue les deux, et
    // sans ça il aurait imputé à Riot une case vide de notre côté.
    return NextResponse.json({ error: "Le suivi Riot est indisponible pour le moment. Le reste de l'application fonctionne : tes parties s'enregistrent à la main." }, { status: 503 });
  }

  const [gameName, tagLine] = riotId.split("#");
  const routing = routageDe(region);

  const res = await fetch(
    `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    { headers: { "X-Riot-Token": apiKey } },
  );

  if (!res.ok) {
    return NextResponse.json({ error: `Joueur introuvable (${res.status})` }, { status: res.status });
  }

  const data = await res.json();
  await prisma.user.update({
    where: { id: user.id },
    data: { riotPuuid: data.puuid, riotId, riotRegion: region },
  });

  return NextResponse.json({ puuid: data.puuid, gameName: data.gameName, tagLine: data.tagLine });
}
