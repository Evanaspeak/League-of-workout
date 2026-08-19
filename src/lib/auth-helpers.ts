import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * L'utilisateur derrière la session courante, ou `null`.
 *
 * La comparaison de génération se fait ici parce que c'est ici qu'on relit
 * déjà la ligne : elle ne coûte donc rien. Sans elle, un jeton volé restait
 * valable trente jours quoi qu'on fasse — réinitialiser le mot de passe d'un
 * compte compromis ne mettait pas l'intrus dehors, alors que l'e-mail envoyé
 * affirmait le contraire.
 */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return null;
  const emise = session.user.epoch ?? 0;
  if (emise < user.sessionEpoch) return null;
  return user;
}
