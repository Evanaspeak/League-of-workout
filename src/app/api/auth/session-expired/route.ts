import { NextResponse } from "next/server";

// Appelé par le SessionGuard quand la session a expiré côté navigateur
// (utilisateur non mémorisé qui rouvre son navigateur).
// Supprime le cookie JWT et redirige vers le login.
export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  res.cookies.delete("authjs.session-token");
  res.cookies.delete("authjs.csrf-token");
  return res;
}
