"use client";
import { useCallback, useEffect, useRef } from "react";
import { useSession } from "@/lib/SessionContext";
import { getLevelParPompes } from "@/lib/scoring";
import { toConduiteSession } from "@/lib/sessionAuto";
import { useT } from "@/lib/i18n/LocaleContext";
import { detection } from "@/lib/i18n/dictionaries/detection";
import { marquerSansEnjeu, oublierSansEnjeu } from "@/lib/sansEnjeu";

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

  /**
   * Poser la question, et agir sur la réponse.
   *
   * Sortie de l'abonnement parce qu'elle sert maintenant à DEUX déclencheurs :
   * le lancement du jeu, et chaque partie de League. Écrite deux fois, elle
   * aurait fini par ne valoir que pour l'un des deux — c'est le motif de règle
   * dupliquée trouvé sept fois sur ce projet.
   */
  const demanderPuisLancer = useCallback(async (jeu: string) => {
    const pont = window.electronLOL;
    if (!pont) return;
    if (actifRef.current) return;
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const s = await res.json();
      const conduite = toConduiteSession(s.user?.sessionAuto);
      if (conduite === "jamais") return;

      if (conduite === "demander") {
        const demander = pont.overlayDemander;
        // Une application antérieure à 0.9.10 ne sait pas poser la question.
        // On ne lance rien : le repli d'un réglage qui dit « demande-moi » ne
        // peut pas être « fais-le sans demander ».
        if (!demander) return;
        const oui = await demander({
          texte: t.demandeTexte(jeu),
          oui: t.demandeOui,
          non: t.demandeNon,
        });
        // `null` = personne n'a répondu avant la fin du délai. C'est un refus
        // pour le LANCEMENT, mais pas pour l'affichage : personne ne l'a vue.
        if (oui !== true) {
          if (oui === false) {
            await pont.overlayMasquerPartie?.().catch(() => {});
            marquerSansEnjeu();
          }
          return;
        }
        if (actifRef.current) return;
      }

      const pompesMax = s.user?.pompesMax ?? 0;
      const niveaux = s.levelConfigs ?? [];
      const niveau = pompesMax > 0 && niveaux.length > 0
        ? getLevelParPompes(pompesMax, niveaux).niveau
        : 1;
      await demarrerRef.current(niveau, jeu);
    } catch {
      // Hors connexion, il n'y a pas de compte à créditer : on laisse filer.
    }
  }, [t]);

  /**
   * Chaque partie de League, et pas seulement le lancement du jeu.
   *
   * `onJeuDetecte` regarde la LISTE DES PROCESSUS : il se déclenche quand
   * League s'ouvre, une fois, et plus jamais tant que le client tourne. On
   * enchaînait donc trois parties avec une seule question — et un refus ne
   * portait que sur la première. Ce n'est pas ce qui avait été demandé : « une
   * fois l'écran de chargement affiché ».
   *
   * Le lanceur, lui, publie sa phase à chaque partie. `GameStart` est l'écran
   * de chargement, `InProgress` la partie elle-même : on prend la première des
   * deux qui arrive, parce que le lanceur saute parfois la première.
   */
  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.onPhase) return;
    let phasePrecedente: string | null = null;
    return pont.onPhase(({ phase }) => {
      const entreEnPartie = (phase === "GameStart" || phase === "InProgress")
        && phasePrecedente !== "GameStart" && phasePrecedente !== "InProgress";
      phasePrecedente = phase ?? null;
      if (!entreEnPartie) return;
      // Une partie qui commence efface le refus de la précédente.
      oublierSansEnjeu();
      void demanderPuisLancer("League of Legends");
    });
  }, [demanderPuisLancer]);

  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.onJeuDetecte) return;

    return pont.onJeuDetecte(({ type, jeu, session }) => {
      if (type !== "jeu-demarre") return;
      /**
       * League est traité par les PHASES du lanceur, pas ici.
       *
       * Cette détection regarde la liste des processus : elle se déclenche
       * quand le jeu s'ouvre, une fois, et plus jamais tant qu'il tourne. Pour
       * League, ça voulait dire une question au lancement et rien aux parties
       * suivantes — donc un refus qui ne portait que sur la première. Les
       * autres jeux, eux, ne racontent rien : leur lancement est le seul
       * moment où l'on sache qu'une partie commence.
       */
      if (jeu === "League of Legends") return;
      // Une partie qui commence efface le refus de la précédente, et ça se
      // fait AVANT toute autre sortie : sinon le souvenir survivrait à un jeu
      // dont la détection ne lance pas de session, et la partie suivante
      // s'enregistrerait sans enjeu sans que personne l'ait demandé.
      oublierSansEnjeu();
      if (!session) return;
      void demanderPuisLancer(jeu);
    });
  }, [demanderPuisLancer]);

  return null;
}
