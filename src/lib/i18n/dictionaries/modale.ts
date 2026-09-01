/**
 * Le seul mot que la coquille d'une fenêtre modale écrit elle-même.
 *
 * Il était en dur, en français, dans `Modale.tsx` — donc lu « Fermer » par un
 * lecteur d'écran japonais. Le garde des textes en dur ne l'attrapait pas : il
 * cherche des chaînes dans le JSX rendu, et celle-ci vivait dans un attribut
 * `aria-label`, c'est-à-dire à l'endroit précis où le texte ne se voit pas et
 * ne s'entend que pour ceux qui n'ont que lui.
 */
export const modale = {
  fr: { fermer: "Fermer" },
  en: { fermer: "Close" },
  es: { fermer: "Cerrar" },
  de: { fermer: "Schließen" },
  zh: { fermer: "关闭" },
  ja: { fermer: "閉じる" },
};
