import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { MAX_GROUPES, nouveauCode, validerNomGroupe } from "@/lib/social";

/**
 * Créer un groupe.
 *
 * Il n'y a pas d'annuaire de groupes, et il n'y en aura pas : un groupe existe
 * pour ceux qui ont son code, et pour personne d'autre. C'est ce qui permet de
 * ne pas avoir à le surveiller (réponse 127).
 */

/** Combien de fois retenter si le code tiré existe déjà. */
const ESSAIS_CODE = 5;

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: { nom?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  const verdict = validerNomGroupe(body.nom);
  if (!verdict.ok) return NextResponse.json({ error: verdict.erreur }, { status: verdict.statut });

  const miens = await prisma.membreGroupe.count({ where: { userId: user.id } });
  if (miens >= MAX_GROUPES) {
    return NextResponse.json({ error: "Trop de groupes" }, { status: 409 });
  }

  /**
   * Deux écritures, et pas de transaction : le pilote de production ne les
   * connaît pas (voir `src/lib/prisma.ts` et `transactionsInterdites.test.ts`).
   * L'ordre est donc la seule protection, et il est choisi :
   *
   * le GROUPE d'abord, l'appartenance ensuite. Une panne entre les deux laisse
   * un groupe que personne ne voit — son code n'a jamais été rendu — et qui
   * n'occupe qu'une ligne. L'inverse est impossible : la clé étrangère refuse
   * une appartenance sans groupe.
   */
  let groupe: { id: string; nom: string; code: string } | null = null;
  for (let essai = 0; essai < ESSAIS_CODE && !groupe; essai++) {
    try {
      groupe = await prisma.groupe.create({
        data: { nom: verdict.valeur, code: nouveauCode() },
        select: { id: true, nom: true, code: true },
      });
    } catch (e) {
      // P2002 : ce code-là est déjà pris. Un autre tirage suffit ; toute autre
      // erreur n'a rien à voir et ne doit pas se faire avaler par la boucle.
      if ((e as { code?: string })?.code !== "P2002") throw e;
    }
  }
  if (!groupe) {
    return NextResponse.json({ error: "Le groupe n'a pas pu être créé" }, { status: 500 });
  }

  await prisma.membreGroupe.create({
    data: { groupeId: groupe.id, userId: user.id, role: "proprietaire" },
  });

  return NextResponse.json({ ...groupe, membres: 1, proprietaire: true });
}
