// Où Apex écrit ses chiffres, et comment les lire.
//
// Mesuré sur des captures réelles en 3440×1440, avec la valeur attendue connue
// d'avance — sans cette vérité de référence, un essai ne vérifie que le lecteur
// rend ce que le lecteur rend.
//
// Les zones sont exprimées en PROPORTION de l'écran, pas en pixels : la même
// interface se pose au même endroit relatif quelle que soit la définition.
// Elles ont été relevées à 3440×1440 et devront être vérifiées sur un écran
// 16:9, où Apex ne place pas tout à fait pareil.

/**
 * Trois enseignements payés par l'expérience, contre-intuitifs tous les trois.
 *
 * 1. NE PAS BINARISER. La recette habituelle veut qu'on seuille en noir sur
 *    blanc. Ici elle dégrade : le seuillage transformait « 1/10 » en « 110 »
 *    en mangeant la barre oblique, et « 386 » en « 586 ». Apex rend un texte
 *    blanc net et bien lissé, que le lecteur digère mieux tel quel.
 *
 * 2. DÉCOUPER CHAQUE NOMBRE À PART quand il voisine une icône. Le cartouche
 *    d'éliminations porte un crâne, une poignée de main et un éclat : découpé
 *    d'un bloc il rendait « 83 264 » au lieu de « 8 · 3 · 2164 ». Découpés un
 *    par un, les trois nombres sortent justes dans tous les modes.
 *
 * 3. DÉCOUPER LA LIGNE ENTIÈRE quand le nombre se déplace. Le classement finit
 *    une phrase : « N° 7 » et « N° 17 » ne commencent pas au même pixel. Viser
 *    le chiffre donnait deux réussites sur trois cadrages ; lire la ligne et en
 *    extraire le dernier nombre en donne six sur six.
 */
const ZONES = {
  /**
   * Écran de fin : « CLASSEMENT : N° 7 ».
   *
   * La lecture rend le texte complet, ce qui sert deux fois : le dernier nombre
   * est le classement, et la présence du mot confirme qu'on est bien sur cet
   * écran-là plutôt que sur un menu qui passait par là.
   */
  classement: {
    x: 1100 / 3440, y: 655 / 1440, w: 1250 / 3440, h: 130 / 1440,
    echelle: 2,
    alphabet: "", // lettres comprises : le mot sert de contrôle
    modes: ["7", "6", "8"],
    /** Le classement est le dernier nombre de la ligne. */
    extraire: (texte) => {
      if (!/CLASSEMENT/i.test(texte.replace(/\s/g, ""))) return null;
      const nombres = texte.match(/\d+/g);
      return nombres ? Number(nombres[nombres.length - 1]) : null;
    },
  },

  /** Cartouche en haut à droite, pendant la partie et en observation. */
  eliminations: { x: 2952 / 3440, y: 210 / 1440, w: 46 / 3440, h: 38 / 1440, echelle: 6, alphabet: "0123456789", modes: ["8", "10", "13"] },
  assistances: { x: 3032 / 3440, y: 210 / 1440, w: 46 / 3440, h: 38 / 1440, echelle: 6, alphabet: "0123456789", modes: ["8", "10", "13"] },
  degats:      { x: 3145 / 3440, y: 210 / 1440, w: 82 / 3440, h: 38 / 1440, echelle: 6, alphabet: "0123456789", modes: ["8", "10", "13"] },
};

/**
 * Ce qu'ont donné les mesures, gardé pour qu'une régression se voie.
 * Capture du 22/08/2026 à 19h56, partie terminée 7e avec 8 éliminations.
 */
const REFERENCE = {
  "19h56m14s": { classement: 7 },
  "19h56m19s": { eliminations: 8, assistances: 3, degats: 2164 },
};

module.exports = { ZONES, REFERENCE };
