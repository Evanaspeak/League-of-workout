import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { COOKIES_SESSION } from "@/lib/cookies";

/**
 * Rend la session volatile : elle mourra avec le navigateur.
 *
 * La case « rester connecté » n'écrivait qu'une clé de `localStorage`. Rien ne
 * partait vers le serveur, et Auth.js émet de toute façon un cookie persistant
 * de trente jours. Le seul garde-fou était un composant React qui déconnectait
 * à l'ouverture — et un composant React ne s'exécute pas quand on tape une
 * adresse d'API dans la barre du navigateur. Sur un poste partagé, la case
 * décochée ne protégeait donc de rien : il suffisait de rouvrir le profil et de
 * demander l'export de données pour repartir avec e-mail, âge, poids et taille.
 *
 * On réécrit ici le même jeton, à l'identique, mais sans date d'expiration.
 * C'est ce qui en fait un cookie de session au sens du navigateur.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const magasin = await cookies();
  const reponse = NextResponse.json({ ok: true });
  let reecrits = 0;

  // Au-delà d'environ 4 ko, Auth.js découpe le cookie en morceaux numérotés.
  // Les réécrire tous, sinon la session se retrouve tronquée et invalide.
  for (const base of COOKIES_SESSION) {
    const secure = base.startsWith("__Secure-");
    for (const morceau of magasin.getAll()) {
      const correspond = morceau.name === base || morceau.name.startsWith(`${base}.`);
      if (!correspond) continue;
      reponse.cookies.set({
        name: morceau.name,
        value: morceau.value,
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure,
        // Ni `expires` ni `maxAge` : c'est précisément ce qui fait mourir le
        // cookie à la fermeture du navigateur.
      });
      reecrits += 1;
    }
  }

  return reponse.headers.has("set-cookie") || reecrits > 0
    ? reponse
    : NextResponse.json({ ok: true, rien: true });
}
