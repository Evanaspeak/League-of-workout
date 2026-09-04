import { redirect } from "next/navigation";
import { avecLocale } from "@/lib/i18n/cheminLocalise";
import { toLocale } from "@/lib/i18n/langues";
import { getCurrentUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import Historique from "./Historique";

/**
 * L'historique, qui sait déjà s'il est vide.
 *
 * La page reste cliente pour tout le reste — filtres, tri, correction de date.
 * Une seule chose est lue ici, et c'est un comptage : **y a-t-il au moins une
 * activité ?**
 *
 * Mesuré le 4 septembre, sur téléphone bridé, avec un compte NEUF : le plus
 * grand élément de la page était le message « c'est depuis le tableau de bord
 * qu'on enregistre une activité », et il ne paraissait qu'après le paquet
 * JavaScript, l'hydratation et un aller-retour vers `/api/games` — 2 940 ms,
 * mesuré trois fois à quarante millisecondes près. Dès qu'il y a des parties,
 * c'est le titre qui l'emporte à 480 ms.
 *
 * Autrement dit l'écran était lent exactement pour la personne qu'on cherche
 * le plus à garder, et rapide pour celles qui sont déjà là. C'est le défaut du
 * tableau de bord, mot pour mot, et c'est sa correction : rendre au serveur le
 * strict nécessaire pour que le texte le plus grand parte dans la réponse.
 *
 * Un `count` borné à un : on ne veut pas le nombre, on veut savoir s'il y en a.
 */
export default async function HistoriquePage(
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(avecLocale("/login", toLocale(locale)));

  /**
   * Les parties SANS ENJEU comptent ici, et c'est voulu.
   *
   * L'historique est le seul écran qui les garde — c'est tout son objet — donc
   * un compte qui n'a que des parties refusées n'est PAS vide, et lui dire
   * « tu n'as rien enregistré » serait faux. C'est la même règle que celle
   * écrite dans la route qui les sert.
   */
  const parties = await prisma.game.count({ where: { userId: user.id }, take: 1 });

  return <Historique depart={{ aucuneActivite: parties === 0 }} />;
}
