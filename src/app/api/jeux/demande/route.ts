import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { DEMANDES_MAX, examinerDemande } from "@/lib/demandeJeu";
import { lireCorps } from "@/lib/corpsRequete";

/**
 * Déclarer un jeu absent du catalogue (réponse 180).
 *
 * « Ça décide de la suite » : ce que la table doit rendre est un compte de
 * PERSONNES, d'où l'unicité par compte posée EN BASE plutôt que dans le code —
 * deux envois partis en même temps liraient tous deux « pas encore demandé ».
 *
 * Le texte est libre et ne sort jamais vers un autre utilisateur : seule
 * l'administration le lit. C'est ce qui le rend compatible avec la réponse 127,
 * qui refuse d'avoir à modérer. Le plafond par compte remplace la surveillance,
 * comme pour les demandes d'amitié.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await lireCorps<unknown>(req);
  if (!body) return NextResponse.json({ error: "Corps illisible" }, { status: 400 });

  const examen = examinerDemande((body as { nom?: unknown } | null)?.nom);
  if (!examen.ok) {
    const message = examen.motif === "deja au catalogue"
      ? "Ce jeu est déjà au catalogue"
      : examen.motif === "trop long"
        ? "Nom de jeu trop long"
        : "Nom de jeu invalide";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const deja = await prisma.demandeJeu.count({ where: { userId: user.id } });
  if (deja >= DEMANDES_MAX) {
    return NextResponse.json(
      { error: "Trop de jeux demandés" }, { status: 429 },
    );
  }

  /**
   * Redemander le même jeu n'est pas une erreur : c'est la même personne, elle
   * compte une fois, et le lui reprocher serait incompréhensible. On rend donc
   * le même succès, sans rien écrire de plus.
   */
  await prisma.demandeJeu.createMany({
    data: [{ userId: user.id, nom: examen.nom, cle: examen.cle }],
    skipDuplicates: true,
  });

  return NextResponse.json({ ok: true, nom: examen.nom });
}
