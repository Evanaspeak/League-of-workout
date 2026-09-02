import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { estAdmin } from "@/lib/admin";


export async function GET() {
  const me = await getCurrentUser();
  if (!me || !estAdmin(me.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  /**
   * Lecture directe, sans le cache du barème, et c'est voulu.
   *
   * Cet écran sert à REGARDER la configuration avant de la modifier : y servir
   * une valeur vieille d'une minute ferait douter de ce qu'on vient
   * d'enregistrer. Le cache existe pour les chemins chauds — enregistrer une
   * partie, calculer un aperçu — pas pour celui-ci, qu'un administrateur ouvre
   * quelques fois par mois.
   */
  const [roles, levels, mastery] = await Promise.all([
    prisma.roleWeight.findMany({ orderBy: { role: "asc" } }),
    prisma.levelConfig.findMany({ orderBy: { niveau: "asc" } }),
    prisma.masteryConfig.findFirst(),
  ]);

  return NextResponse.json({ roles, levels, mastery });
}
