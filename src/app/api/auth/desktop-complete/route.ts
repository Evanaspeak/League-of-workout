import { NextResponse } from "next/server";

// Appelé par Chrome après que le JWT a été transféré à Electron.
// Supprime la session Chrome et redirige vers la page de confirmation.
export async function GET(request: Request) {
  const redirectUrl = new URL("/login?transferred=1", request.url);
  const response = NextResponse.redirect(redirectUrl);
  // En production le cookie porte le préfixe `__Secure-` : ne supprimer que le
  // nom en clair laissait la session ouverte dans le navigateur, alors que la
  // page annonce le contraire.
  for (const nom of ["authjs.session-token", "__Secure-authjs.session-token"]) {
    response.cookies.delete(nom);
  }
  return response;
}
