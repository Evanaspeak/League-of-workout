import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { getClientIp, isRateLimited, recordAttempt } from "@/lib/rate-limit";

/**
 * Un problème signalé depuis l'application.
 *
 * Ouverte sans session, volontairement : un problème sur l'écran de connexion
 * est le pire de tous, et exiger d'être connecté pour le signaler ferait
 * exactement l'inverse de ce qu'on cherche. La limite porte donc sur l'adresse.
 */

/** Longueurs retenues. Au-delà, on tronque plutôt que de refuser. */
const MAX_MESSAGE = 2000;
const MAX_PAGE = 200;
const MAX_CONTEXTE = 2000;

/**
 * Ce qu'on accepte de garder du contexte envoyé par le navigateur.
 *
 * Une liste fermée, et non l'objet tel quel : la page qui remplit ce champ est
 * du code client, donc modifiable, et rien n'empêcherait d'y glisser le contenu
 * d'un formulaire. Un signalement n'est pas une capture d'écran.
 */
const CLES_CONTEXTE = [
  "version", "bureau", "langue", "ecran", "navigateur", "connecte",
] as const;

function nettoyerContexte(brut: unknown): string {
  const source = (brut ?? {}) as Record<string, unknown>;
  const garde: Record<string, string> = {};
  for (const cle of CLES_CONTEXTE) {
    const v = source[cle];
    if (v === undefined || v === null) continue;
    garde[cle] = String(v).slice(0, 200);
  }
  return JSON.stringify(garde).slice(0, MAX_CONTEXTE);
}

/** L'adresse d'une page, sans ce qui la suit. */
function nettoyerPage(brut: unknown): string {
  const texte = String(brut ?? "").slice(0, MAX_PAGE);
  // Les paramètres de requête portent parfois un jeton de récupération : ils
  // n'ont rien à faire dans une table qu'on relira des mois plus tard.
  return texte.split(/[?#]/)[0] || "/";
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (await isRateLimited(ip, "signalement")) {
    return NextResponse.json(
      { error: "Trop de signalements envoyés. Réessayez dans quelques minutes." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  const brut = (body ?? {}) as Record<string, unknown>;
  const message = String(brut.message ?? "").trim().slice(0, MAX_MESSAGE);
  if (message.length < 5) {
    return NextResponse.json({ error: "Décrivez le problème en quelques mots." }, { status: 400 });
  }

  // La session est lue, jamais exigée, et l'identité vient d'elle seule : un
  // `userId` envoyé par le client signerait le signalement au nom d'un autre.
  const user = await getCurrentUser().catch(() => null);

  await recordAttempt(ip, "signalement");
  await prisma.signalement.create({
    data: {
      userId: user?.id ?? null,
      message,
      page: nettoyerPage(brut.page),
      contexte: nettoyerContexte(brut.contexte),
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
