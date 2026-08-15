import { NextResponse } from "next/server";
import { seedDefaults } from "@/lib/seed-defaults";

/**
 * Initialise la configuration de scoring globale. Écrit en base sans qu'un
 * utilisateur soit connecté : elle sert au tout premier démarrage, avant qu'il
 * existe le moindre compte. Elle est donc protégée par un secret partagé —
 * sans lui, n'importe qui pourrait la marteler et consommer le quota de la
 * base à chaque appel.
 */
export async function GET(req: Request) {
  const attendu = process.env.INIT_SECRET;
  if (!attendu) {
    return NextResponse.json(
      { error: "Initialisation non configurée" },
      { status: 503 },
    );
  }
  const fourni = new URL(req.url).searchParams.get("secret")
    ?? req.headers.get("x-init-secret");
  if (fourni !== attendu) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  await seedDefaults();
  return NextResponse.json({ ok: true });
}
