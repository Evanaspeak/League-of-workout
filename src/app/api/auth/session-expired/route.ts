import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const res = NextResponse.redirect(new URL("/login", request.url));
  // Auth.js utilise le préfixe __Secure- en production (HTTPS)
  // et le nom sans préfixe en développement (HTTP)
  const cookiesToDelete = [
    "authjs.session-token",
    "authjs.csrf-token",
    "__Secure-authjs.session-token",
    "__Secure-authjs.csrf-token",
  ];
  for (const name of cookiesToDelete) {
    res.cookies.delete(name);
  }
  return res;
}
