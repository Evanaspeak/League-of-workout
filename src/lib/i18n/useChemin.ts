"use client";
import { usePathname } from "next/navigation";
import { sansLocale } from "./cheminLocalise";

/**
 * Le chemin de la page, SANS sa langue.
 *
 * C'est la forme sous laquelle tout le reste de l'application le connaît :
 * `estPagePublique("/history")`, `path === "/"`, la visite guidée, la
 * navigation qui souligne l'onglet courant. Depuis que la langue est dans
 * l'adresse, `usePathname` rend `/ja/history` — et toutes ces comparaisons
 * deviendraient fausses d'un coup, en silence : le menu ne soulignerait plus
 * rien, la modale d'accueil s'inviterait sur les pages publiques, le rail
 * s'afficherait sur la page d'accueil.
 *
 * Un seul endroit retire le préfixe. `src/cheminSansLangue.test.ts` refuse
 * `usePathname` partout ailleurs : deux composants qui décideraient chacun de
 * leur côté finiraient par ne pas décider pareil.
 *
 * Deux exceptions, chacune avec sa raison, et toutes deux ont besoin du chemin
 * ENTIER : le sélecteur de langue, qui réécrit l'adresse, et `Lien`, qui la
 * fabrique.
 */
export function useChemin(): string {
  return sansLocale(usePathname() || "/");
}
