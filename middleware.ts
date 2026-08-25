import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { estCheminPublic } from "@/lib/routesPubliques";

// On utilise le wrapper Auth.js pour lire la session (il sait déchiffrer le
// cookie JWT v5 — contrairement à getToken qui échouait et renvoyait tout le
// monde vers /login).
const { auth } = NextAuth(authConfig);

// Domaine canonique de production. Toute requête arrivant sur une URL de
// déploiement Vercel (ex: league-of-workout-xxxx-projects.vercel.app) est
// redirigée ici AVANT toute connexion. Sinon le cookie PKCE OAuth est posé sur
// le domaine de déploiement mais le callback Google arrive sur le domaine
// canonique → erreur "Invalid code verifier" → double connexion.
const CANONICAL_HOST =
  process.env.AUTH_CANONICAL_HOST ?? "winorworkout.com";


export default auth((req) => {
  const host = req.headers.get("host") ?? "";

  // Canonicalisation du domaine (uniquement pour les URLs Vercel, jamais en local).
  if (host.endsWith(".vercel.app") && host !== CANONICAL_HOST) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(url, 308);
  }

  const { pathname } = req.nextUrl;

  // Routes publiques : accès libre. La liste et la règle qui la lit vivent
  // dans `src/lib/routesPubliques.ts`, pour que le test de la porte éprouve
  // la règle qui tourne plutôt qu'une copie de son côté.
  if (estCheminPublic(pathname)) {
    return NextResponse.next();
  }

  // Routes protégées : req.auth est rempli par Auth.js si la session est valide.
  if (!req.auth) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // Tout ce qui est listé ici échappe à l'authentification. Le manifeste, le
  // service worker et les icônes d'installation doivent rester accessibles
  // sans session : le navigateur et le système les réclament parfois sans
  // envoyer les cookies, et un service worker redirigé vers /login ne
  // s'enregistre jamais.
  matcher: [
    // `videos/` : la vidéo de démonstration du héros. Sans elle, le fichier
    // partait vers /login comme n'importe quelle page protégée, et le lecteur
    // restait noir pour tout visiteur non connecté, c'est-à-dire pour tout le
    // monde sur la page d'accueil.
    //
    // Les exclusions portent sur des chemins précis, jamais sur une extension.
    // « .*\\.png$ » dispensait du contrôle TOUTE adresse finissant par .png —
    // y compris /api/admin/users/x.png, qui atteint bien son handler. Les
    // contrôles en place dans chaque handler rattrapaient le coup ; la
    // convention « les pages sont protégées par le middleware » était fausse.
    // `_vercel/` : le script de mesure d'audience. Il partait vers /login comme
    // une page protégée, et le navigateur refusait alors de l'exécuter — « MIME
    // type text/html is not executable ». La mesure ne remontait donc rien, et
    // rien ne le signalait : une page de connexion rendue en 200 ressemble à un
    // script qui s'est chargé. Trouvé en regardant la console pendant un test.
    "/((?!_next/static|_next/image|_vercel/|favicon\\.ico|riot\\.txt|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|sw\\.js|api/pwa-icon|opengraph-image|icon$|apple-icon$|icons/|images/|videos/).*)",
  ],
};
