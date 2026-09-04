"use client";
import { useEffect } from "react";
import { useChemin } from "@/lib/i18n/useChemin";
import { formaterCompact, toExerciceIds, ventiler, type Repartition } from "@/lib/exercices";
import { estPagePublique } from "@/lib/pagesPubliques";
import { titreAvecDette } from "@/lib/titreOnglet";
import { useContexteConnecte } from "@/lib/ContexteConnecte";
import { useDateLocale } from "@/lib/i18n/LocaleContext";

/**
 * Le compteur de dette dans le titre de l'onglet.
 *
 * C'est le rappel le moins coûteux qui existe : il ne notifie rien, ne réclame
 * aucune permission, et se voit dans la barre d'onglets quand la page est en
 * arrière-plan — c'est-à-dire précisément quand on est en train de jouer.
 *
 * Il se repose à chaque navigation : le routeur réécrit le titre, et le
 * compteur disparaîtrait au premier changement de page.
 */
export function TitreAvecDette() {
  const chemin = useChemin();
  const publique = estPagePublique(chemin);
  /**
   * La dette vient du contexte commun, plus d'un appel à soi.
   *
   * Ce composant et le compteur du rail la demandaient chacun de leur côté :
   * deux fois la même réponse à chaque chargement de page, et deux fois encore
   * après chaque paiement, puisque tous deux écoutaient `wow-dette-changee`.
   * L'événement est écouté une seule fois, dans le fournisseur.
   */
  const { dette } = useContexteConnecte();
  const etiquette = useDateLocale();

  useEffect(() => {
    if (typeof document === "undefined") return;
    // Sur une page publique, personne n'est connecté : un compteur y serait
    // celui de la session précédente, ou rien du tout.
    if (publique) {
      document.title = titreAvecDette(document.title, null);
      return;
    }

    const poser = (valeur: string | null) => {
      document.title = titreAvecDette(document.title, valeur);
    };

    // Tant que la réponse n'est pas revenue, on ne pose rien : afficher zéro
    // puis la vraie valeur ferait clignoter le titre de l'onglet.
    if (dette === undefined) return;

    let valeur: string | null = null;
    if (dette && (Number(dette.points) || 0) > 0) {
      const lignes = ventiler((dette.repartition ?? {}) as Repartition, null, etiquette);
      // Un seul exercice : sa valeur suffit. Plusieurs : on prend le premier
      // plutôt que d'écrire « 19 · 2 min 10 » dans un onglet large de six
      // caractères.
      valeur = lignes.length > 0
        ? lignes[0].valeur
        : formaterCompact(dette.points, toExerciceIds([])[0], null, etiquette);
    }
    poser(valeur);

    /**
     * Et on le repose quand Next réécrit le titre.
     *
     * C'est le défaut qui rendait ce compteur invisible quatre fois sur cinq :
     * l'effet ne passe QU'UNE fois, à l'arrivée de la dette, et Next rend ses
     * métadonnées de son côté — donc écrit `document.title` à un instant qu'on
     * ne commande pas. Quand cette écriture tombe après la nôtre, le compteur
     * disparaît pour de bon, et rien ne le repose avant la prochaine
     * navigation. Mesuré avant correction sur cinq chargements du même écran :
     * une fois présent, quatre fois absent.
     *
     * L'observateur ne peut pas boucler : reposer le compteur rend le titre
     * conforme, donc la mutation suivante ne demande plus rien.
     */
    if (valeur === null) return;
    const attendu = valeur;
    const observateur = new MutationObserver(() => {
      if (document.title === titreAvecDette(document.title, attendu)) return;
      document.title = titreAvecDette(document.title, attendu);
    });
    observateur.observe(document.head, { childList: true, subtree: true, characterData: true });

    return () => {
      observateur.disconnect();
      // On retire le compteur en partant : laisser « (38) » sur une page qui
      // ne le met plus à jour est pire que ne rien afficher.
      if (typeof document !== "undefined") {
        document.title = titreAvecDette(document.title, null);
      }
    };
  }, [publique, chemin, dette, etiquette]);

  return null;
}
