import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { cookies } from "next/headers";

// POST — retourne le JWT de session courant pour le transférer à l'app desktop.
// Appelé par le dashboard Chrome après un OAuth réussi en mode desktop.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const cookieStore = await cookies();
  // Auth.js uses __Secure- prefix on HTTPS (Vercel) but not on HTTP (localhost).
  const jwt =
    cookieStore.get("__Secure-authjs.session-token")?.value ??
    cookieStore.get("authjs.session-token")?.value;

  if (!jwt) {
    return NextResponse.json({ error: "Token de session introuvable" }, { status: 401 });
  }

  return NextResponse.json({ jwt });
}
