import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIES_SESSION, COOKIE_TOUR_DESKTOP, supprimerCookie } from "@/lib/cookies";

/**
 * Ouvre un tour de connexion pour l'application desktop.
 *
 * Deux choses, dans cet ordre, et volontairement dans une requête à part :
 *
 *  1. La session du navigateur s'en va. Auth.js, quand un cookie de session est
 *     déjà là, ne connecte pas le compte OAuth choisi : il le rattache à
 *     l'utilisateur courant et rend la session d'origine. L'application
 *     repartait alors avec un compte que personne n'avait choisi — ou se
 *     faisait refuser le transfert, ce qui revenait à recommencer.
 *     La fermeture se faisait jusqu'ici dans la même action serveur que
 *     l'ouverture ; les deux se disputaient les mêmes cookies dans une seule
 *     réponse. Séparées, l'ordre ne se discute plus.
 *
 *  2. On date le tour. Cet horodatage-là vient du serveur, comme celui que la
 *     connexion inscrira dans le jeton : les deux se comparent donc sur la même
 *     horloge. La borne vivait auparavant dans le `localStorage` du poste, et
 *     un poste en avance de quelques secondes suffisait à faire refuser une
 *     connexion valide.
 */
export async function POST() {
  const magasin = await cookies();
  const reponse = NextResponse.json({ ok: true });

  // Les morceaux comptent autant que le cookie entier : au-delà d'environ 4 ko,
  // Auth.js découpe le jeton en `.0`, `.1`… et n'effacer que le nom de base
  // laissait une session parfaitement lisible derrière soi.
  for (const base of COOKIES_SESSION) {
    supprimerCookie(reponse, base);
    for (const morceau of magasin.getAll()) {
      if (morceau.name.startsWith(`${base}.`)) supprimerCookie(reponse, morceau.name);
    }
  }

  reponse.cookies.set({
    name: COOKIE_TOUR_DESKTOP,
    value: String(Date.now()),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Dix minutes : le temps de choisir un compte chez le fournisseur, pas
    // celui de laisser traîner une autorisation.
    maxAge: 600,
  });

  return reponse;
}
