import { NextResponse } from "next/server";

// Appelé par Chrome après que le JWT a été transféré à Electron.
// Supprime la session Chrome et redirige vers la page de confirmation.
export async function GET(request: Request) {
  const redirectUrl = new URL("/login?transferred=1", request.url);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete("authjs.session-token");
  return response;
}
