/**
 * Les initiales de victoire et de défaite.
 *
 * Deux lettres, et elles vivent ICI parce qu'elles servent des deux côtés du
 * réseau : le tableau de bord les affiche sous le taux de victoire, le bilan
 * hebdomadaire les écrit dans un courriel. Écrites deux fois, elles auraient
 * divergé à la première correction — c'est le motif que ce projet paie en
 * boucle, et il ne prend jamais la forme d'une copie qu'on remarque.
 *
 * Elles étaient « V » et « D » en dur dans les deux endroits, donc en français
 * dans les six langues : un lecteur anglais lisait deux lettres qui ne
 * désignent rien chez lui, et l'espagnol tombait juste par hasard.
 */
export const resultat = {
  fr: { victoire: "V", defaite: "D" },
  en: { victoire: "W", defaite: "L" },
  es: { victoire: "V", defaite: "D" },
  de: { victoire: "S", defaite: "N" },
  zh: { victoire: "胜", defaite: "负" },
  ja: { victoire: "勝", defaite: "敗" },
};
