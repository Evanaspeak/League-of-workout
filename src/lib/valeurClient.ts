"use client";
import { useSyncExternalStore } from "react";

/**
 * Valeurs qui n'existent que dans le navigateur : stockage local, préférence
 * système, pont de l'application desktop.
 *
 * La tentation est de les lire dans un effet et d'appeler `setState`. Cela
 * fonctionne, mais impose un second rendu à chaque montage, et React le
 * signale. `useSyncExternalStore` fait le même travail proprement : le rendu
 * serveur reçoit la valeur de repli, le navigateur la vraie, et la bascule est
 * gérée sans rendu en cascade ni écart d'hydratation.
 */

/** Sans abonnement : la valeur est lue une fois et ne change plus d'elle-même. */
const SANS_ABONNEMENT = () => () => {};

/**
 * @param lire          Lecture côté navigateur. Doit renvoyer une valeur
 *                      primitive : React compare les instantanés par identité,
 *                      et un objet recréé à chaque appel boucle indéfiniment.
 * @param defautServeur Ce que rend le serveur, faute de navigateur.
 * @param abonner       Facultatif, pour les valeurs qui évoluent. Doit garder
 *                      la même identité d'un rendu à l'autre.
 */
export function useValeurClient<T>(
  lire: () => T,
  defautServeur: T,
  abonner: (onChange: () => void) => () => void = SANS_ABONNEMENT,
): T {
  return useSyncExternalStore(abonner, lire, () => defautServeur);
}

// Un abonnement par requête média, conservé d'un rendu à l'autre : en recréer
// un à chaque fois ferait se réabonner React sans fin.
const abonnements = new Map<string, (onChange: () => void) => () => void>();

function abonnementMedia(requete: string) {
  let abonner = abonnements.get(requete);
  if (!abonner) {
    abonner = (onChange: () => void) => {
      const mq = window.matchMedia(requete);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    };
    abonnements.set(requete, abonner);
  }
  return abonner;
}

/** Suit une requête média, et la respecte encore si elle change en cours de route. */
export function useRequeteMedia(requete: string, defautServeur = false): boolean {
  return useValeurClient(
    () => window.matchMedia(requete).matches,
    defautServeur,
    abonnementMedia(requete),
  );
}

/** Vrai quand l'utilisateur demande à son système de limiter les animations. */
export function useMouvementReduit(): boolean {
  return useRequeteMedia("(prefers-reduced-motion: reduce)");
}
