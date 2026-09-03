import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { nouveauCode } from "@/lib/parrainage";

/**
 * Son lien de parrainage, et ce qu'il a donné.
 *
 * **Le code se tire à la PREMIÈRE LECTURE**, contrairement au jeton de
 * diffusion qui attend qu'on le demande. La différence n'est pas un oubli :
 * une adresse publique qui montre quelque chose de vous ne doit pas exister
 * par défaut, alors qu'un code de parrainage ne révèle rien — il ne permet que
 * de créer un compte en devenant votre ami, ce qui suppose déjà de vouloir
 * s'inscrire. Le mettre derrière un bouton « engendrer » ajouterait un geste
 * entre quelqu'un et la seule chose qu'il est venu chercher : le lien.
 */

/** Combien de fois on retente en cas de collision de code. */
const ESSAIS = 5;

/**
 * Le code du compte, tiré s'il n'en a pas encore.
 *
 * L'unicité vit en base : deux tirages simultanés ne peuvent pas poser le même
 * code, l'un des deux tombe sur `P2002` et retente. Sans cette reprise, une
 * collision — improbable, mais pas impossible sur 31^8 — rendrait une erreur
 * serveur sur l'écran des amis, pour une raison que personne ne devinerait.
 */
async function codeDuCompte(user: { id: string; codeParrain: string | null }): Promise<string | null> {
  if (user.codeParrain) return user.codeParrain;
  for (let essai = 0; essai < ESSAIS; essai += 1) {
    try {
      const maj = await prisma.user.update({
        where: { id: user.id },
        data: { codeParrain: nouveauCode() },
        select: { codeParrain: true },
      });
      return maj.codeParrain;
    } catch (e) {
      if ((e as { code?: string })?.code !== "P2002") throw e;
    }
  }
  /**
   * Cinq collisions d'affilée ne veut plus dire « pas de chance » mais « le
   * tirage est cassé ». On rend `null` plutôt que de boucler : l'écran dira
   * que le lien n'a pas pu être créé, ce qui est vrai, au lieu de tourner.
   */
  return null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [code, filleuls] = await Promise.all([
    codeDuCompte({ id: user.id, codeParrain: user.codeParrain ?? null }),
    prisma.user.count({ where: { parrainId: user.id } }),
  ]);

  return NextResponse.json({ code, filleuls });
}
