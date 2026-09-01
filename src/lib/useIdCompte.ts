"use client";
import { useEffect, useState } from "react";
import { chargerContexte } from "@/lib/chargerContexte";

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
 * La mémoire a déménagé dans `chargerContexte` : elle y sert aussi au
 * fournisseur de contexte, qui demandait sinon la même chose de son côté —
 * soit deux appels là où il en faut un. Le compte n'est qu'une partie de ce
 * que rend `/api/contexte`.
 */
export function chargerCompte(): Promise<Compte | null> {
  return chargerContexte().then((c) => {
    const u = c?.user;
    return u && typeof u.id === "string" ? (u as Compte) : null;
  });
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
