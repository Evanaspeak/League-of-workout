import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { JOURS_SAISON } from "@/lib/bilanSaison";
import { BilanClient } from "./BilanClient";

/**
 * Le bilan de saison.
 *
 * La page est cliente — elle lit ses chiffres après montage, et ses textes
 * viennent des dictionnaires du navigateur. Ce qui se décide ici, c'est le
 * seul point qui ne pouvait pas attendre : **le compte a-t-il des parties ?**
 *
 * Mesuré à 3628 ms sur téléphone bridé, le plus grand élément étant l'image du
 * bilan. La chaîne était : télécharger le JavaScript, hydrater, appeler
 * `/api/bilan`, rendre la balise, et seulement là commencer à charger l'image.
 * Quatre étapes en série pour une ressource qui ne dépend d'aucune d'elles.
 *
 * Il suffit de savoir s'il y a des parties pour poser la balise : la réponse
 * tient en un comptage sur un index, et elle part avec le HTML. React se
 * charge du reste — voyant une image dans le rendu serveur, il en émet lui-même
 * l'indication de préchargement. **2100 ms**, c'est-à-dire l'instant exact où
 * l'image finit d'arriver : le plancher de cette page.
 *
 * Une indication de préchargement écrite à la main avait été ajoutée avant de
 * s'apercevoir que React la produisait déjà. Retirée : deux fois la même chose
 * ne va pas deux fois plus vite, et la mesure le confirme au pixel près.
 */
export default async function BilanPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  /**
   * Un compte sans partie ne verra pas l'image : la demander lui ferait
   * dessiner un bilan vide pour rien, côté serveur comme côté réseau.
   */
  const parties = await prisma.game.count({
    where: {
      userId: user.id,
      date: { gte: new Date(Date.now() - JOURS_SAISON * 24 * 60 * 60 * 1000) },
    },
  });
  return <BilanClient aDesParties={parties > 0} />;
}
