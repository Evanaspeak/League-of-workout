"use client";
import { useEffect, useRef } from "react";
import { useSession } from "@/lib/SessionContext";
import { getLevelParPompes } from "@/lib/scoring";

/**
 * Démarre une session quand l'application desktop détecte le lancement d'un jeu
 * surveillé.
 *
 * Le suivi vit dans la page et non dans l'application : c'est ici qu'on connaît
 * le compte connecté, son niveau et ses exercices. L'application se contente de
 * dire qu'un jeu vient de démarrer.
 */
export function DetectionSession() {
  const { sessionActive, startSession } = useSession();

  // Lus au moment de l'événement plutôt que capturés à l'abonnement : sans ça,
  // on se réabonnerait à chaque changement d'état de session.
  const actifRef = useRef(sessionActive);
  const demarrerRef = useRef(startSession);

  useEffect(() => { actifRef.current = sessionActive; }, [sessionActive]);
  useEffect(() => { demarrerRef.current = startSession; }, [startSession]);

  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.onJeuDetecte) return;

    return pont.onJeuDetecte(async ({ type, jeu, session }) => {
      if (type !== "jeu-demarre" || !session) return;
      // Une session déjà en cours n'est pas remplacée : le joueur a peut-être
      // lancé le suivi lui-même, avec d'autres réglages.
      if (actifRef.current) return;

      try {
        const res = await fetch("/api/settings");
        // Hors connexion, il n'y a pas de compte à créditer : on laisse filer.
        if (!res.ok) return;
        const s = await res.json();
        const pompesMax = s.user?.pompesMax ?? 0;
        const niveaux = s.levelConfigs ?? [];
        const niveau = pompesMax > 0 && niveaux.length > 0
          ? getLevelParPompes(pompesMax, niveaux).niveau
          : 1;
        await demarrerRef.current(niveau, jeu);
      } catch {
        /* le joueur garde la main : il peut démarrer la session lui-même */
      }
    });
  }, []);

  return null;
}
