/**
 * Le nom de l'effort PAYÉ, écrit une seule fois.
 *
 * C'est la même grandeur partout — la somme des points de `Paiement` d'un
 * compte — et elle s'affiche sur TROIS écrans : la colonne du classement entre
 * amis, la carte du bilan de saison, et le profil public. Elle y était nommée
 * trois fois, à la main, et elle avait divergé :
 *
 * | | classement | bilan | profil public |
 * |---|---|---|---|
 * | fr, en, es | identiques | identiques | identiques |
 * | de | Bezahlter Aufwand | Bezahlter Aufwand | Geleisteter Aufwand |
 * | zh | 已完成努力 | 已完成训练 | 已还努力 |
 * | ja | こなした努力 | こなした運動 | 果たした努力 |
 *
 * Le chinois annonçait donc « entraînements accomplis » et le japonais « le
 * sport qu'on a fait » AU-DESSUS d'une quantité d'effort — « 480 俯卧撑 ». Un
 * COMPTE de séances par-dessus une QUANTITÉ : c'est exactement le défaut déjà
 * corrigé sur « Victoires » qui coiffait un pourcentage, et le nom est ce qui
 * l'empêche de se refaire.
 *
 * Ce qui décide de la formulation retenue n'est pas le goût : c'est le
 * classement, seul écran à EXPLIQUER la grandeur juste au-dessus d'elle, et
 * dont le texte d'aide emploie déjà les mêmes mots — « 真正完成的努力量 » en
 * chinois, « 実際にこなした努力量 » en japonais. La colonne et son explication
 * s'accordaient ; ce sont les deux autres écrans qui s'en écartaient.
 *
 * Les trois langues qui coïncidaient — français, anglais, espagnol — ne
 * prouvaient rien : elles avaient été recopiées. Ce sont l'allemand, le chinois
 * et le japonais qui ont dérivé, c'est-à-dire les trois qu'on ne relit pas.
 */
export const effortPaye = {
  fr: { nom: "Effort payé" },
  en: { nom: "Effort paid" },
  es: { nom: "Esfuerzo pagado" },
  de: { nom: "Bezahlter Aufwand" },
  zh: { nom: "已完成努力" },
  ja: { nom: "こなした努力" },
};
