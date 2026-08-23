import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import TableauDeBord from "./TableauDeBord";

/**
 * Le tableau de bord, rendu avec son premier écran déjà écrit.
 *
 * La page reste cliente pour tout le reste — statistiques, graphiques, mode
 * session. Seules les trois valeurs du rappel de test de force sont lues ici :
 * elles tiennent en une requête, elles ne changent qu'une fois par mois, et
 * sans elles le haut de la page n'avait rien à montrer avant le retour de
 * `/api/dashboard`.
 *
 * Deux lectures, en parallèle, et rien de plus : ce n'est pas un
 * pré-chargement du tableau de bord, c'est le strict nécessaire pour que le
 * texte le plus grand de la page parte dans la réponse.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const niveaux = await prisma.levelConfig.findMany({ orderBy: { niveau: "asc" } });

  return (
    <TableauDeBord
      depart={{
        pompesMax: user.pompesMax ?? 0,
        // La date traverse en texte : le composant est client, et une `Date`
        // ne franchit pas la frontière autrement.
        pompesMaxLe: user.pompesMaxLe ? user.pompesMaxLe.toISOString() : null,
        niveaux,
      }}
    />
  );
}
