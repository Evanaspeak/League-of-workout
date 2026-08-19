import { NextResponse } from "next/server";
import { COOKIES_CSRF, COOKIES_SESSION, supprimerCookie } from "@/lib/cookies";

export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  // Auth.js utilise un préfixe en production (HTTPS) et le nom nu en
  // développement. Le préfixe impose des attributs : sans eux, le navigateur
  // jette la directive entière et rien n'est supprimé.
  for (const name of [...COOKIES_SESSION, ...COOKIES_CSRF]) {
    supprimerCookie(res, name);
  }
  return res;
}
