import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";

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

// POST — retourne le JWT de session courant pour le transférer à l'app desktop.
// Appelé par le dashboard Chrome après un OAuth réussi en mode desktop.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const cookieStore = await cookies();
  const jwt = lireJeton(cookieStore.getAll());

  if (!jwt) {
    return NextResponse.json({ error: "Token de session introuvable" }, { status: 401 });
  }

  // L'instant de l'authentification part avec le jeton : c'est lui qui permet
  // à l'appelant de refuser une session ouverte AVANT que l'application ne la
  // demande. Sans quoi le transfert emportait simplement la session courante
  // du navigateur, quelle qu'elle soit et si ancienne fût-elle.
  return NextResponse.json({ jwt, connexion: session.user.connexion ?? null });
}
