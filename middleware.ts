import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Domaine canonique de production. Toute requête arrivant sur une URL de
// déploiement Vercel (ex: league-of-workout-xxxx-projects.vercel.app) est
// redirigée ici AVANT toute connexion. Sinon le cookie PKCE OAuth est posé sur
// le domaine de déploiement mais le callback Google arrive sur le domaine
// canonique → erreur "Invalid code verifier" → double connexion.
const CANONICAL_HOST =
  process.env.AUTH_CANONICAL_HOST ?? "league-of-workout.vercel.app";

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

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") ?? "";

  // Canonicalisation du domaine (uniquement pour les URLs Vercel, jamais en local).
  if (host.endsWith(".vercel.app") && host !== CANONICAL_HOST) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(url, 308);
  }

  const { pathname } = req.nextUrl;

  if (pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|riot\\.txt|.*\\.png$|.*\\.svg$).*)"],
};
