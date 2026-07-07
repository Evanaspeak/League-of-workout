import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

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

const PUBLIC_PREFIXES = [
  "/beta",
  "/api/beta",
  "/login",
  "/waitlist",
  "/cgu",
  "/confidentialite",
  "/telechargement",
  "/api/auth",
];

export default auth((req) => {
  const host = req.headers.get("host") ?? "";

  // Canonicalisation du domaine (uniquement pour les URLs Vercel, jamais en local).
  if (host.endsWith(".vercel.app") && host !== CANONICAL_HOST) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(url, 308);
  }

  const { pathname } = req.nextUrl;

  // Routes publiques : accès libre.
  if (pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|riot\\.txt|.*\\.png$|.*\\.svg$).*)"],
};
