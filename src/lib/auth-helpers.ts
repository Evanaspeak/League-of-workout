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
  // L'empreinte du mot de passe ne sort pas de la base.
  //
  // Cet objet circule dans une cinquantaine de routes ; il suffit qu'une seule
  // le rende tel quel pour publier le condensat. Deux routes le retiraient à la
  // main, chacune de son côté — une garantie qui vit à trois endroits n'en est
  // pas une. Elle vit désormais ici, à la lecture, et les routes qui ont
  // vraiment besoin de l'empreinte la demandent par un `select` explicite.
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    omit: { passwordHash: true },
  });
  if (!user) return null;
  const emise = session.user.epoch ?? 0;
  if (emise < user.sessionEpoch) return null;
  return user;
}

