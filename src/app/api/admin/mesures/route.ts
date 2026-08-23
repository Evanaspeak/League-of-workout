import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estAdmin } from "@/lib/admin";
import { calculerMesures, type CompteMesure } from "@/lib/mesures";

/**
 * Ce que le produit fait vraiment, chiffré.
 *
 * Deux questions restées sans réponse faute d'instrument : combien de temps
 * entre l'inscription et la première partie, et combien de personnes
 * reviennent. On répondait « aucune idée ».
 *
 * La lecture charge tous les comptes. À cent utilisateurs c'est sans objet ; à
 * dix mille il faudra passer par des agrégats en base. Le seuil est noté ici
 * pour qu'on s'en souvienne avant que la page ne devienne lente.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !estAdmin(user.email)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const comptes = await prisma.user.findMany({
    select: {
      createdAt: true,
      games: {
        // La date d'ENREGISTREMENT, pas celle de la partie : une partie
        // rattrapée se date la veille, et le délai en ressortait négatif.
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const mesures: CompteMesure[] = comptes.map((c) => {
    const jours = new Set(
      c.games.map((g) => g.createdAt.toISOString().slice(0, 10)),
    );
    return {
      cree: c.createdAt,
      premierePartie: c.games[0]?.createdAt ?? null,
      joursActifs: jours.size,
    };
  });

  return NextResponse.json(calculerMesures(mesures));
}
