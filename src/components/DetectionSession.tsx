"use client";
import { useEffect, useRef } from "react";
import { useSession } from "@/lib/SessionContext";
import { getLevelParPompes } from "@/lib/scoring";
import { toConduiteSession } from "@/lib/sessionAuto";
import { useT } from "@/lib/i18n/LocaleContext";
import { detection } from "@/lib/i18n/dictionaries/detection";

/**
 * Ce qui se passe quand l'application détecte le lancement d'un jeu surveillé.
 *
 * Le suivi vit dans la page et non dans l'application : c'est ici qu'on connaît
 * le compte connecté, son niveau et ses exercices. L'application se contente de
 * dire qu'un jeu vient de démarrer — et, depuis, d'afficher une question par
 * -dessus l'écran de chargement et d'en rendre la réponse.
 *
 * **La session ne se lance plus toute seule par défaut.** Elle le faisait, sans
 * le dire, et le propriétaire du produit l'a signalé : une session ouverte
 * sonde Riot, chronomètre les jeux comptés au temps, et décide donc de ce qui
 * entrera dans la dette. La démarrer à la place de quelqu'un est une surprise
 * sur un compteur qui fait faire des pompes.
 *
 * L'écran de chargement est le seul instant où l'on sait qu'une partie commence
 * et où l'on n'est pas encore en jeu : c'est là que la question se pose. Sans
 * réponse avant la fin du délai, on ne lance rien — quelqu'un qui joue ne se
 * retient pas.
 *
 * Les trois conduites vivent dans `sessionAuto.ts` et se règlent dans les
 * réglages : demander, lancer seul, ne rien faire.
 */
export function DetectionSession() {
  const { sessionActive, startSession } = useSession();
  const t = useT(detection);

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
        const conduite = toConduiteSession(s.user?.sessionAuto);
        if (conduite === "jamais") return;

        if (conduite === "demander") {
          const demander = pont.overlayDemander;
          // Une application antérieure à 0.9.10 ne sait pas poser la question.
          // On ne lance rien : le repli d'un réglage qui dit « demande-moi »
          // ne peut pas être « fais-le sans demander ».
          if (!demander) return;
          const oui = await demander({
            texte: t.demandeTexte(jeu),
            oui: t.demandeOui,
            non: t.demandeNon,
          });
          // `null` = personne n'a répondu avant la fin du délai. C'est un refus.
          if (oui !== true) return;
          // La question a duré : la session a pu être lancée à la main
          // entre-temps, ou une autre partie avoir commencé.
          if (actifRef.current) return;
        }

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
