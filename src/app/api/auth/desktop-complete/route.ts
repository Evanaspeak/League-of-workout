import { NextResponse } from "next/server";
import { COOKIES_SESSION, supprimerCookie } from "@/lib/cookies";

// Appelé par Chrome après que le JWT a été transféré à Electron.
// Supprime la session Chrome et redirige vers la page de confirmation.
export async function GET(request: Request) {
  const redirectUrl = new URL("/login?transferred=1", request.url);
  const response = NextResponse.redirect(redirectUrl);
  // La suppression passe par un helper : posée sans son attribut `Secure`, la
  // directive était ignorée en bloc pour un nom préfixé `__Secure-`, donc la
  // session restait grande ouverte alors que la page annonçait le contraire.
  for (const nom of COOKIES_SESSION) supprimerCookie(response, nom);
  return response;
}
