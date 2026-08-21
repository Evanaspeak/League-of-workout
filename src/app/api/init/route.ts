import { timingSafeEqual } from "node:crypto";
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
  if (!identiques(fourni, attendu)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  await seedDefaults();
  return NextResponse.json({ ok: true });
}

/**
 * Compare deux secrets sans que la durée de la comparaison ne dise combien de
 * caractères étaient déjà bons.
 *
 * L'opérateur `!==` s'arrête au premier caractère qui diffère : la durée
 * dépend donc du secret. Le canal est trop bruité pour que ce soit exploitable
 * en pratique, mais la comparaison correcte tient en trois lignes et dispense
 * d'avoir à en juger.
 */
function identiques(fourni: string | null, attendu: string): boolean {
  if (!fourni) return false;
  const a = Buffer.from(fourni);
  const b = Buffer.from(attendu);
  // `timingSafeEqual` exige deux tampons de même taille, et lève sinon. La
  // longueur d'un secret n'est pas ce qu'il protège : on la compare d'abord.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
