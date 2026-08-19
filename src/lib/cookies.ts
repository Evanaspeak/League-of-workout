import type { NextResponse } from "next/server";

/**
 * Supprimer un cookie de session, pour de bon.
 *
 * `response.cookies.delete(nom)` n'émet ni `Secure` ni `Path`. Or la RFC 6265bis
 * impose au navigateur d'ignorer **l'intégralité** du `Set-Cookie` pour un nom
 * préfixé `__Secure-` qui n'a pas l'attribut `Secure`, et pour un `__Host-` qui
 * n'a pas en plus `Path=/` sans domaine. Chrome, Firefox et Safari l'appliquent.
 *
 * En production, le cookie de session porte justement ce préfixe : la
 * déconnexion ne supprimait donc rien, pendant que l'écran de confirmation
 * annonçait à l'utilisateur que sa session était fermée. Elle ne l'était pas.
 */
export function supprimerCookie(reponse: NextResponse, nom: string): void {
  const protege = nom.startsWith("__Secure-") || nom.startsWith("__Host-");
  reponse.cookies.set({
    name: nom,
    value: "",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
    // Le drapeau doit accompagner le nom, sinon la directive est jetée en bloc.
    secure: protege,
    httpOnly: true,
    sameSite: "lax",
  });
}

/**
 * Tous les noms sous lesquels Auth.js range la session, en clair comme
 * préfixés : le préfixe dépend du protocole, donc de l'environnement.
 */
export const COOKIES_SESSION = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
];

/**
 * Le tour de connexion ouvert par l'application desktop.
 *
 * Il ne contient qu'un horodatage, mais posé par le SERVEUR. C'est ce qui
 * permet ensuite de comparer l'instant de la demande et l'instant de la
 * connexion sur la même horloge : la borne vivait auparavant dans le
 * `localStorage` du navigateur, si bien qu'un poste en avance de quelques
 * secondes sur le serveur faisait refuser une connexion parfaitement valide —
 * et l'utilisateur repartait pour un second tour chez Google.
 */
export const COOKIE_TOUR_DESKTOP = "low_tour_desktop";

/** Idem pour le jeton anti-CSRF, dont le préfixe diffère selon les versions. */
export const COOKIES_CSRF = [
  "authjs.csrf-token",
  "__Secure-authjs.csrf-token",
  "__Host-authjs.csrf-token",
];
