"use client";
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from "react";
import { useChemin } from "@/lib/i18n/useChemin";
import { estPagePublique } from "@/lib/pagesPubliques";
import { chargerContexte, rafraichirContexte } from "@/lib/chargerContexte";

/**
 * Ce que le compte connecté a de commun à tous les écrans, demandé UNE fois.
 *
 * Trois routes portaient ces trois blocs, et chaque page connectée les
 * appelait toutes les trois. Pire : la dette partait DEUX fois, le compteur du
 * rail et le titre de l'onglet la demandant chacun de son côté sans savoir que
 * l'autre existait. Mesuré sur le serveur local : neuf appels d'API pour un
 * chargement du tableau de bord, six pour l'historique, sept pour les réglages.
 *
 * En production, chaque requête SQL est un appel HTTPS indépendant vers Neon —
 * le client passe par `PrismaNeonHttp`, pas par un pool TCP. Trois lectures du
 * même enregistrement coûtent donc trois allers-terours, pas trois fois rien.
 *
 * Le rafraîchissement passe par l'événement `wow-dette-changee`, qui existait
 * déjà et que les deux composants écoutaient chacun de leur côté : il est
 * écouté ici, une seule fois, et tout le monde voit la nouvelle valeur.
 */

type Dette = {
  points: number;
  exercices: string[];
  repartition: Record<string, number>;
  dureeSec: number;
  seuilSec: number;
};

type Consentement = {
  etat: "jamais" | "accepte" | "refuse";
  aDesDonnees: boolean;
  depuis: string | null;
};

type Compte = Record<string, unknown> & { estAdmin?: boolean };

type Valeur = {
  /** `undefined` tant que la réponse n'est pas revenue ; `null` si elle a échoué. */
  user: Compte | null | undefined;
  dette: Dette | null | undefined;
  consentement: Consentement | null | undefined;
  /** Redemande tout au serveur. */
  recharger: () => Promise<void>;
  /**
   * Pose la dette rendue par une écriture, sans nouvel aller-retour.
   *
   * `PATCH /api/dette` rend déjà l'état d'après : la relire serait une requête
   * pour une valeur qu'on tient dans la main.
   */
  poserDette: (d: Dette) => void;
  poserConsentement: (c: Consentement) => void;
};

const Contexte = createContext<Valeur | null>(null);

export function ContexteConnecteProvider({ children }: { children: React.ReactNode }) {
  const chemin = useChemin();
  const publique = estPagePublique(chemin);
  const [user, setUser] = useState<Compte | null | undefined>(undefined);
  const [dette, setDette] = useState<Dette | null | undefined>(undefined);
  const [consentement, setConsentement] = useState<Consentement | null | undefined>(undefined);

  const poser = useCallback((c: Awaited<ReturnType<typeof chargerContexte>>) => {
    // `null` plutôt qu'une attente sans fin : hors ligne ou session expirée,
    // les écrans doivent pouvoir dire qu'ils ne savent pas. `SessionGuard`
    // s'occupe de la session elle-même.
    setUser((c?.user ?? null) as Compte | null);
    setDette((c?.dette ?? null) as Dette | null);
    setConsentement((c?.consentement ?? null) as Consentement | null);
  }, []);

  /**
   * La PREMIÈRE lecture passe par la mémoire de module, partagée avec
   * `useIdCompte` : sans elle, ce fournisseur et cette mémoire feraient deux
   * appels pour la même réponse. Le rafraîchissement, lui, redemande vraiment.
   */
  const recharger = useCallback(async () => { poser(await rafraichirContexte()); }, [poser]);

  useEffect(() => {
    // Aucun compte sur une page publique : la route répondrait 401, et
    // demander pour rien est précisément ce qu'on vient de retirer.
    if (publique) return;
    void chargerContexte().then(poser);
    const surChangement = () => { void recharger(); };
    // Le retour sur l'onglet resynchronise : la partie a pu être enregistrée
    // depuis un autre appareil, ou par l'application Windows pendant qu'on
    // jouait. La règle vivait dans le compteur de dette, seul à la connaître.
    const surRetour = () => { if (!document.hidden) void recharger(); };
    window.addEventListener("wow-dette-changee", surChangement);
    document.addEventListener("visibilitychange", surRetour);
    return () => {
      window.removeEventListener("wow-dette-changee", surChangement);
      document.removeEventListener("visibilitychange", surRetour);
    };
  }, [publique, poser, recharger]);

  const valeur = useMemo<Valeur>(() => ({
    user, dette, consentement, recharger,
    poserDette: setDette,
    poserConsentement: setConsentement,
  }), [user, dette, consentement, recharger]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

/**
 * Le contexte, ou un repli inerte.
 *
 * Le repli n'est pas une facilité : la source de diffusion OBS a sa propre
 * coquille, sans ce fournisseur, et un composant partagé qui s'y retrouverait
 * ne doit pas faire tomber la page.
 */
export function useContexteConnecte(): Valeur {
  return useContext(Contexte) ?? {
    user: undefined, dette: undefined, consentement: undefined,
    recharger: async () => {},
    poserDette: () => {},
    poserConsentement: () => {},
  };
}
