"use client";
import { useEffect, useState } from "react";

type Compte = {
  id: string;
  introGeneration?: number;
  estAdmin?: boolean;
  pseudo?: string;
};

/**
 * Une seule interrogation du serveur par chargement de page.
 *
 * Plusieurs composants ont besoin de savoir qui est connecté — la barre de
 * navigation pour montrer ou non le lien d'administration, l'accueil et la
 * visite guidée pour savoir à qui ils s'adressent, les réglages pour leur
 * bouton de rejeu. Chacun le demandait de son côté : `/api/user` était appelé
 * trois fois sur le tableau de bord et cinq fois dans les réglages, soit
 * autant de lectures en base pour une réponse identique.
 *
 * La promesse est mémorisée au niveau du module. Elle vit donc le temps du
 * chargement de la page — exactement la durée pendant laquelle l'identité ne
 * peut pas changer, puisqu'en changer impose de recharger.
 */
let enCours: Promise<Compte | null> | null = null;

export function chargerCompte(): Promise<Compte | null> {
  if (!enCours) {
    enCours = fetch("/api/user")
      .then((r) => (r.ok ? r.json() : null))
      .then((u) => (u && typeof u.id === "string" ? (u as Compte) : null))
      .catch(() => null);
  }
  return enCours;
}

/** À appeler si le compte a pu changer sans rechargement de page. */
export function oublierCompte(): void {
  enCours = null;
}

/** Le compte connecté : `undefined` tant qu'on ne sait pas, `null` si aucun. */
export function useCompte(): Compte | null | undefined {
  const [compte, setCompte] = useState<Compte | null | undefined>(undefined);
  useEffect(() => {
    let obsolete = false;
    chargerCompte().then((c) => { if (!obsolete) setCompte(c ?? null); });
    return () => { obsolete = true; };
  }, []);
  return compte;
}

/**
 * La clé sous laquelle ce compte range ses marques de première visite.
 *
 * Elle porte la génération d'intro, qui vient du compte : un administrateur
 * peut ainsi rendre les marques caduques sans avoir accès au navigateur de
 * l'intéressé — la clé change, et l'intro rejoue.
 */
export function useIdCompte(): string | null | undefined {
  const compte = useCompte();
  if (compte === undefined) return undefined;
  if (compte === null) return null;
  const generation = typeof compte.introGeneration === "number" ? compte.introGeneration : 0;
  return generation > 0 ? `${compte.id}#${generation}` : compte.id;
}
