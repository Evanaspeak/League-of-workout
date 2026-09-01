import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { reponseConsentement } from "@/lib/contexteConnecte";

/**
 * Consentement au traitement des données de santé.
 *
 * Le genre, l'âge, le poids, la taille et les heures de sport, croisés avec
 * l'activité physique enregistrée, relèvent de l'article 9 du RGPD. Ils étaient
 * demandés à l'inscription sans que personne consente à autre chose qu'aux CGU
 * générales — et la politique de confidentialité affirmait par-dessus le marché
 * qu'aucune donnée de santé n'était collectée.
 *
 * Trois états, et non deux : jamais demandé, accepté, refusé. Sans le premier,
 * on ne saurait pas à qui poser la question, et on la reposerait à chaque
 * connexion à ceux qui ont déjà dit non.
 */

/** Les champs que ce consentement couvre. Un refus les efface tous. */
const CHAMPS_SANTE = {
  genre: null,
  age: null,
  poids: null,
  taille: null,
  sportsHoursPerWeek: null,
} as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  return NextResponse.json(reponseConsentement(user));
}

/**
 * Enregistre la réponse.
 *
 * `{ accepte: true }`  → la date d'acceptation est posée, les données restent.
 * `{ accepte: false }` → la date de refus est posée, les cinq champs sont vidés.
 *
 * Le refus efface vraiment. Garder les données en s'abstenant de les afficher
 * ne serait pas un retrait de consentement : la conservation est déjà un
 * traitement.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }
  const accepte = (body as { accepte?: unknown } | null)?.accepte;
  if (typeof accepte !== "boolean") {
    return NextResponse.json({ error: "Réponse manquante" }, { status: 400 });
  }

  const maintenant = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: accepte
      ? { santeConsentiLe: maintenant, santeRefuseLe: null }
      : { santeConsentiLe: null, santeRefuseLe: maintenant, ...CHAMPS_SANTE },
  });

  return NextResponse.json({ etat: accepte ? "accepte" : "refuse", depuis: maintenant });
}

/**
 * Retire un consentement déjà donné.
 *
 * C'est le droit de l'article 7.3, et il doit être aussi simple à exercer que
 * l'a été le fait de consentir. Un DELETE fait la même chose qu'un
 * `{ accepte: false }` — la route existe pour que l'intention se lise.
 */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const maintenant = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { santeConsentiLe: null, santeRefuseLe: maintenant, ...CHAMPS_SANTE },
  });
  return NextResponse.json({ etat: "refuse", depuis: maintenant });
}
