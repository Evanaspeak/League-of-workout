"use client";
import { useEffect, useRef } from "react";
import { ventiler } from "@/lib/exercices";
import { estSansEnjeu, oublierSansEnjeu } from "@/lib/sansEnjeu";
import { useT, useDateLocale, useNombre } from "@/lib/i18n/LocaleContext";
import { enJeu } from "@/lib/i18n/dictionaries/enJeu";

/**
 * Enregistre la partie qu'on vient de lire à l'écran d'Apex.
 *
 * La lecture se fait dans l'application desktop, qui seule voit l'écran.
 * L'enregistrement se fait ici, parce que la page seule porte la session du
 * compte : l'application n'a ni le jeton ni le barème.
 *
 * Aucune confirmation n'est demandée — c'est le choix assumé : on appuie à la
 * fin d'une partie, elle part dans l'historique. Une erreur de lecture se
 * corrige dans l'historique, où la date et les chiffres sont déjà modifiables.
 */
export function PartieApexLue() {
  const t = useT(enJeu);
  const etiquette = useDateLocale();
  const nombre = useNombre();
  /**
   * Dernière partie enregistrée, pour ne pas la compter deux fois.
   *
   * L'écran de classement reste affiché plusieurs secondes : deux appuis
   * rapprochés liraient la même partie et créeraient deux dettes. On retient
   * donc ce qu'on vient d'écrire, et on refuse l'identique dans la foulée.
   */
  const derniereRef = useRef<{ cle: string; quand: number } | null>(null);

  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.onPartieLue) return;

    return pont.onPartieLue(async (lu) => {
      const dire = (texte: string, ok: boolean) => pont.direDansOverlay?.(texte, ok);

      const cle = `${lu.jeu}/${lu.classement}/${lu.eliminations}`;
      const avant = derniereRef.current;
      // Deux minutes : plus court qu'une partie d'Apex, plus long que le temps
      // d'affichage de l'écran de fin.
      if (avant && avant.cle === cle && Date.now() - avant.quand < 120_000) {
        return dire(t.dejaEnregistree, false);
      }

      /**
       * La partie avait-elle été refusée au lancement du jeu ?
       *
       * La question est posée pour TOUS les jeux — League par les phases du
       * lanceur, les autres au démarrage de leur processus — et un « non » y
       * pose la même marque. Ce chemin-ci ne la lisait pas : refuser au
       * lancement d'Apex laissait quand même la partie suivante créer sa
       * dette, c'est-à-dire l'inverse exact de ce qu'on venait de répondre.
       *
       * Lue et consommée ici comme du côté de League : une question, une
       * partie. Ce qu'un lancement de jeu qui n'annonce QUE son lancement
       * devrait couvrir — la partie suivante, ou toute la soirée — est un
       * arbitrage, et il part dans les questions.
       */
      const sansEnjeu = estSansEnjeu();
      oublierSansEnjeu();
      try {
        const res = await fetch("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jeu: lu.jeu,
            typeJeu: "parties",
            sansEnjeu,
            placement: lu.classement,
            kills: lu.eliminations,
          }),
        });
        if (!res.ok) {
          const erreur = await res.json().catch(() => null);
          return dire(t.refuse(String(erreur?.error ?? res.status)), false);
        }
        derniereRef.current = { cle, quand: Date.now() };

        const { scoring, repartition } = await res.json();
        // La quantité réelle plutôt qu'un nombre de points : « 30 s de boxe »
        // n'est pas « 30 pompes », et c'est la page qui connaît l'exercice
        // choisi. Sans ventilation, on retombe sur le total — sauf sans
        // enjeu, où `pompesFinales` reste le coût que la partie AURAIT eu :
        // le repli annoncerait alors une dette qu'on ne doit pas.
        const du = sansEnjeu
          ? t.sansEnjeu
          : ventiler(repartition ?? {}, null, etiquette).map((v) => v.valeur).join(" · ")
            || nombre(Number(scoring?.pompesFinales) || 0);
        // Le doute de la lecture se dit : si les modes ne se sont pas accordés,
        // le chiffre mérite d'être vérifié dans l'historique.
        const doute = lu.accord < lu.essais || !lu.elimSures ? t.aVerifier : "";
        dire(t.ligneApex(nombre(lu.classement), nombre(lu.eliminations), du) + doute, true);

        // Le compteur de dette et l'historique se rafraîchissent.
        window.dispatchEvent(new Event("wow-dette-changee"));
      } catch {
        dire(t.horsLigne, false);
      }
    });
  }, [t]);

  return null;
}
