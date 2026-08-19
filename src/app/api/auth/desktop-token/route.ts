import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { COOKIE_TOUR_DESKTOP, supprimerCookie } from "@/lib/cookies";

/**
 * Noms possibles du cookie de session, du plus probable au moins probable.
 * Auth.js ajoute le préfixe `__Secure-` en HTTPS (production) et s'en passe en
 * HTTP (développement local).
 */
const NOMS = ["__Secure-authjs.session-token", "authjs.session-token"];

/**
 * Reconstitue le jeton, y compris quand Auth.js l'a découpé.
 *
 * Au-delà d'environ 4 ko, un cookie est réparti sur plusieurs morceaux
 * numérotés (`.0`, `.1`, …) : lire le seul nom de base renvoie alors `undefined`
 * et le transfert vers l'application échoue sans que rien ne le signale.
 */
function lireJeton(toutes: { name: string; value: string }[]): string | null {
  for (const base of NOMS) {
    const entier = toutes.find((c) => c.name === base);
    if (entier) return entier.value;

    const morceaux = toutes
      .filter((c) => c.name.startsWith(`${base}.`))
      .map((c) => ({ i: Number(c.name.slice(base.length + 1)), v: c.value }))
      .filter((m) => Number.isInteger(m.i))
      .sort((a, b) => a.i - b.i);
    if (morceaux.length > 0) return morceaux.map((m) => m.v).join("");
  }
  return null;
}

/**
 * Tolérance entre l'ouverture du tour et l'horodatage de la connexion.
 *
 * Les deux instants viennent maintenant du serveur, pas du poste : il ne s'agit
 * plus d'absorber une horloge mal réglée mais la seule dérive entre deux
 * instances, qui se compte en millisecondes.
 */
const MARGE_MS = 2000;

// POST — retourne le JWT de session courant pour le transférer à l'app desktop.
// Appelé par le dashboard Chrome après un OAuth réussi en mode desktop.
export async function POST() {
  const cookieStore = await cookies();
  const tour = Number(cookieStore.get(COOKIE_TOUR_DESKTOP)?.value ?? 0);

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const jwt = lireJeton(cookieStore.getAll());
  if (!jwt) {
    return NextResponse.json({ error: "Token de session introuvable" }, { status: 401 });
  }

  /** Le tour est à usage unique : il meurt avec la réponse qui le juge. */
  const conclure = (corps: Record<string, unknown>, statut: number) => {
    const reponse = NextResponse.json(corps, { status: statut });
    supprimerCookie(reponse, COOKIE_TOUR_DESKTOP);
    return reponse;
  };

  // Le transfert ne porte que sur une session ouverte APRÈS la demande de
  // l'application. Sans cette borne, c'est la session qui traînait déjà dans le
  // navigateur qu'on expédiait — et l'application repartait avec un compte que
  // personne n'avait choisi.
  if (!Number.isFinite(tour) || tour <= 0) {
    return conclure({ error: "Tour de connexion absent", raison: "sans-tour" }, 409);
  }
  const connexion = session.user.connexion;
  if (typeof connexion !== "number" || connexion < tour - MARGE_MS) {
    return conclure({ error: "Session antérieure à la demande", raison: "session-anterieure" }, 409);
  }

  return conclure({ jwt }, 200);
}
