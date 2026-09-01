"use client";
import { useEffect, useRef, type RefObject } from "react";

/** Ce qui peut recevoir le focus au clavier à l'intérieur de la fenêtre. */
const FOCUSABLES = [
  "a[href]", "button:not([disabled])", "input:not([disabled])",
  "select:not([disabled])", "textarea:not([disabled])", "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Le clavier dans une fenêtre modale : entrer, tourner en rond, sortir.
 *
 * Une fenêtre qui porte `aria-modal="true"` PROMET que le reste de la page
 * n'existe plus tant qu'elle est ouverte. À la souris, la promesse se tient
 * toute seule : le fond est opaque et le clic dessus ferme. Au clavier, non —
 * la tabulation continue dans la page derrière, sur des commandes qu'on ne
 * voit pas, et il n'y a rien pour dire qu'on en est sorti.
 *
 * `src/modalesAnnoncees.test.ts` exige depuis août que chaque recouvrement
 * s'annonce. Il ne dit rien de ce qui se passe une fois l'annonce faite :
 * quatre fenêtres portaient donc `role="dialog"` et `aria-modal` sans aucun
 * des trois comportements ci-dessous. C'est le même angle mort que la fois
 * précédente — l'audit ne cherchait pas ce qui manquait, il vérifiait ce qui
 * était là.
 *
 * Trois choses, et les trois comptent :
 *
 * - le focus ENTRE dans la fenêtre à l'ouverture, sinon la première tabulation
 *   part du haut de la page derrière ;
 * - il y TOURNE tant qu'elle est ouverte ;
 * - il REVIENT à ce qui l'a ouverte à la fermeture, sinon on perd sa place et
 *   on repart du haut du document.
 *
 * Ce hook ne s'emploie QUE sur une fenêtre modale. `InvitationInstallation`
 * est un `role="dialog"` sans `aria-modal` — une bannière en bas d'écran qui
 * ne recouvre rien : y piéger le focus empêcherait d'atteindre la page qu'on
 * était en train de lire, ce qui serait un défaut et non une correction.
 */
/**
 * Le dernier élément qui a eu le focus HORS d'une fenêtre modale.
 *
 * Il faut le suivre en continu, et on ne peut pas se contenter de lire
 * `document.activeElement` au moment où la fenêtre s'ouvre : quand un champ du
 * formulaire porte `autoFocus`, React le focalise pendant la validation du
 * rendu, c'est-à-dire AVANT que l'effet ci-dessous ne s'exécute. On capturait
 * alors ce champ comme « l'endroit d'où l'on vient » — et comme il disparaît
 * avec la fenêtre, le rendre au focus ne rendait rien du tout : on repartait
 * du haut du document.
 *
 * C'est exactement ce qui se passait sur la confirmation de suppression de
 * compte, dont le champ « tapez SUPPRIMER » est en `autoFocus`. Trouvé en
 * instrumentant, pas en relisant : le code avait l'air juste, et la capture
 * était faite à un instant qui ne l'était pas.
 */
let dernierHorsFenetre: HTMLElement | null = null;

if (typeof document !== "undefined") {
  // En capture, pour voir aussi les focus posés par un composant enfant.
  document.addEventListener("focusin", () => {
    const el = document.activeElement as HTMLElement | null;
    if (el && !el.closest('[aria-modal="true"]')) dernierHorsFenetre = el;
  }, true);
}

export function usePiegeFocus(
  panneauRef: RefObject<HTMLElement | null>,
  {
    actif = true,
    onEchap,
    gelerLeDefilement = true,
  }: {
    /**
     * La fenêtre est-elle ouverte ?
     *
     * Deux façons d'appeler ce hook, et il faut les deux. Un composant qui ne
     * se monte QUE lorsque la fenêtre est ouverte n'a rien à passer : le
     * montage est déjà le signal. Un composant qui reste monté et qui rend sa
     * fenêtre sous condition — le compteur de dette, les réglages — doit dire
     * quand elle s'ouvre, sinon le piège se poserait au chargement de la page.
     */
    actif?: boolean;
    /**
     * Ce que fait la touche Échap. Absent, elle ne fait rien — c'est le cas
     * d'une fenêtre qui pose une question dont la réponse conditionne la
     * suite, et qui porte ses issues elle-même.
     */
    onEchap?: (() => void) | null;
    /**
     * Gèle le défilement de la page dessous. Vrai par défaut : sans ça le fond
     * glisse sous les doigts sur téléphone. Une fenêtre qui ne recouvre pas
     * tout l'écran n'en veut pas.
     */
    gelerLeDefilement?: boolean;
  } = {},
) {
  /**
   * Les options sont lues par RÉFÉRENCE, et l'effet ne se rejoue jamais.
   *
   * `onEchap` est presque toujours écrit en ligne par l'appelant, donc recréé à
   * chaque rendu. En faire une dépendance rejouerait l'effet à chaque frappe et
   * à chaque seconde de compte à rebours — et chaque relance rendrait le focus
   * au premier élément, en plein milieu de la saisie.
   */
  const optionsRef = useRef({ onEchap, gelerLeDefilement });
  useEffect(() => { optionsRef.current = { onEchap, gelerLeDefilement }; });

  useEffect(() => {
    if (!actif) return;
    /**
     * Où revenir en sortant.
     *
     * L'élément courant fait l'affaire tant qu'il est hors de la fenêtre. S'il
     * est déjà dedans — un champ en `autoFocus` a pris la main pendant la
     * validation du rendu — on reprend le dernier connu hors fenêtre, sinon on
     * rendrait le focus à un nœud qui va être démonté.
     */
    const courant = document.activeElement as HTMLElement | null;
    const rendreA = courant && !courant.closest('[aria-modal="true"]')
      ? courant
      : dernierHorsFenetre;
    const premier = panneauRef.current?.querySelector<HTMLElement>(FOCUSABLES);
    (premier ?? panneauRef.current)?.focus();

    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") { optionsRef.current.onEchap?.(); return; }
      if (e.key !== "Tab") return;
      const cibles = Array.from(
        panneauRef.current?.querySelectorAll<HTMLElement>(FOCUSABLES) ?? [],
      // Une commande cachée reste dans le document : sans ce filtre, la
      // tabulation s'arrêterait sur un élément invisible.
      ).filter((el) => el.offsetParent !== null);
      if (cibles.length === 0) return;
      const debut = cibles[0];
      const fin = cibles[cibles.length - 1];
      if (e.shiftKey && document.activeElement === debut) {
        e.preventDefault(); fin.focus();
      } else if (!e.shiftKey && document.activeElement === fin) {
        e.preventDefault(); debut.focus();
      }
    };

    document.addEventListener("keydown", surTouche);
    const overflowInitial = document.body.style.overflow;
    if (optionsRef.current.gelerLeDefilement) document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      if (optionsRef.current.gelerLeDefilement) document.body.style.overflow = overflowInitial;
      // Un nœud démonté entre-temps ne reprend pas le focus : le lui donner
      // enverrait sur `body`, c'est-à-dire au tout début du document.
      if (rendreA?.isConnected) rendreA.focus?.();
    };
    // `actif` est la SEULE dépendance : le piège se pose à l'ouverture et se
    // lève à la fermeture, jamais entre les deux. Y ajouter les options les
    // ferait rejouer à chaque frappe, et chaque relance rendrait le focus au
    // premier élément — d'où la lecture par référence plus haut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actif]);
}
