"use client";
import { useEffect, useRef } from "react";
import { ventiler } from "@/lib/exercices";
import { useT, useDateLocale } from "@/lib/i18n/LocaleContext";
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

      try {
        const res = await fetch("/api/games", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jeu: lu.jeu,
            typeJeu: "parties",
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
        // choisi. Sans ventilation, on retombe sur le total.
        const du = ventiler(repartition ?? {}, null, etiquette).map((v) => v.valeur).join(" · ")
          || String(Number(scoring?.pompesFinales) || 0);
        // Le doute de la lecture se dit : si les modes ne se sont pas accordés,
        // le chiffre mérite d'être vérifié dans l'historique.
        const doute = lu.accord < lu.essais || !lu.elimSures ? t.aVerifier : "";
        dire(`#${lu.classement} · ${lu.eliminations} élim · ${du}${doute}`, true);

        // Le compteur de dette et l'historique se rafraîchissent.
        window.dispatchEvent(new Event("wow-dette-changee"));
      } catch {
        dire(t.horsLigne, false);
      }
    });
  }, [t]);

  return null;
}
