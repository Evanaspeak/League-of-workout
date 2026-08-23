import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estAdmin } from "@/lib/admin";

/**
 * Les problèmes signalés, pour la seule personne qui puisse les corriger.
 *
 * Sans cet écran, les signalements s'écrivaient en base et personne ne les
 * lisait : un formulaire qui recueille sans que rien n'en sorte est pire
 * qu'aucun formulaire, parce qu'il laisse croire qu'on a été entendu.
 */

/** Assez pour une soirée de bêta, pas assez pour peser sur la page. */
const MAX = 100;

async function administrateur() {
  const user = await getCurrentUser();
  if (!user || !estAdmin(user.email)) return null;
  return user;
}

export async function GET() {
  if (!(await administrateur())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const lignes = await prisma.signalement.findMany({
    orderBy: [{ statut: "asc" }, { createdAt: "desc" }],
    take: MAX,
    select: {
      id: true, createdAt: true, message: true, page: true,
      contexte: true, statut: true,
      // Le pseudo suffit à recontacter quelqu'un depuis la liste des comptes.
      // L'adresse électronique n'a pas à traverser une liste qu'on garde
      // ouverte dans un onglet.
      user: { select: { pseudo: true } },
    },
  });

  return NextResponse.json(lignes.map((l) => ({
    ...l,
    // Le contexte est stocké en texte : il se relit ici, une fois, plutôt que
    // dans le navigateur à chaque affichage.
    contexte: JSON.parse(l.contexte || "{}") as Record<string, unknown>,
    pseudo: l.user?.pseudo ?? null,
    user: undefined,
  })));
}

/** Marque un signalement traité, ou le rouvre. */
export async function PATCH(req: Request) {
  if (!(await administrateur())) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }
  const { id, statut } = (body ?? {}) as { id?: unknown; statut?: unknown };
  if (typeof id !== "string" || !id) {
    return NextResponse.json({ error: "Signalement manquant" }, { status: 400 });
  }
  if (statut !== "ouvert" && statut !== "traite") {
    return NextResponse.json({ error: "Statut inconnu" }, { status: 400 });
  }

  await prisma.signalement.update({ where: { id }, data: { statut } });
  return NextResponse.json({ ok: true });
}
