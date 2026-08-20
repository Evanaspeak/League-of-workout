import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estAdmin } from "@/lib/admin";
import {
  EXERCICES_REGLABLES, RATIOS_DEFAUT, RATIO_BORNES, normaliserRatios,
} from "@/lib/exercices";
import { CLE_RATIOS, oublierRatios } from "@/lib/exercicesConfig";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !estAdmin(user.email)) return null;
  return user;
}

const refus = () => NextResponse.json({ error: "Accès refusé" }, { status: 403 });

/**
 * Purge le cache après un changement de ratio.
 *
 * Le cache mémoire ne suffit pas : les pages sans données propres au compte
 * sont prérendues, et leur HTML porte les ratios du moment où il a été
 * fabriqué. Sans cette invalidation, l'administration enregistrait bien la
 * nouvelle valeur, la dette la respectait, et les écrans continuaient
 * d'afficher l'ancienne conversion — le pire des trois cas, parce que rien
 * n'avait l'air cassé.
 *
 * L'invalidation porte sur la mise en page racine : c'est elle qui charge les
 * ratios, donc toutes les pages qu'elle enveloppe sont concernées.
 */
function purger() {
  oublierRatios();
  revalidatePath("/", "layout");
}

/** Ratios en vigueur, plus de quoi construire le formulaire sans les redire. */
export async function GET() {
  if (!await requireAdmin()) return refus();

  let ratios = { ...RATIOS_DEFAUT };
  let parDefaut = true;
  try {
    const ligne = await prisma.systemConfig.findUnique({ where: { key: CLE_RATIOS } });
    if (ligne) {
      ratios = normaliserRatios(JSON.parse(ligne.value));
      parDefaut = false;
    }
  } catch {
    // Table absente : le formulaire s'ouvre sur les valeurs d'origine.
  }

  return NextResponse.json({
    ratios,
    parDefaut,
    defauts: RATIOS_DEFAUT,
    bornes: RATIO_BORNES,
    reglables: EXERCICES_REGLABLES,
  });
}

export async function PUT(req: Request) {
  if (!await requireAdmin()) return refus();

  let corps: unknown;
  try {
    corps = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  const brut = (corps as { ratios?: unknown } | null)?.ratios;
  if (!brut || typeof brut !== "object") {
    return NextResponse.json({ error: "Format invalide" }, { status: 400 });
  }

  // Les pompes restent la référence : quoi qu'on envoie, leur ratio ne bouge
  // pas. On ne le refuse pas pour autant, on l'ignore — un client qui renvoie
  // l'objet complet reçu du GET ne doit pas se voir opposer une erreur.
  const propose = { ...(brut as Record<string, unknown>), pompes: RATIOS_DEFAUT.pompes };
  const ratios = normaliserRatios(propose);

  try {
    await prisma.systemConfig.upsert({
      where: { key: CLE_RATIOS },
      update: { value: JSON.stringify(ratios) },
      create: { key: CLE_RATIOS, value: JSON.stringify(ratios) },
    });
  } catch {
    return NextResponse.json(
      { error: "Erreur base de données : la table SystemConfig n'existe pas encore." },
      { status: 500 },
    );
  }

  purger();
  return NextResponse.json({ ok: true, ratios });
}

/** Retour aux ratios d'origine. */
export async function DELETE() {
  if (!await requireAdmin()) return refus();
  try {
    await prisma.systemConfig.deleteMany({ where: { key: CLE_RATIOS } });
  } catch {
    // Rien à supprimer : le résultat voulu est déjà atteint.
  }
  purger();
  return NextResponse.json({ ok: true, ratios: RATIOS_DEFAUT });
}
