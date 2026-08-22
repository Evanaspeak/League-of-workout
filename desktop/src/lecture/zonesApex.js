// Où Apex écrit ses chiffres, et comment les lire.
//
// Mesuré sur des captures réelles en 3440×1440, avec la valeur attendue connue
// d'avance — sans cette vérité de référence, un essai ne vérifie que le lecteur
// rend ce que le lecteur rend.

/**
 * Quatre enseignements payés par l'expérience, contre-intuitifs tous les
 * quatre.
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
 *
 * 4. LE CARTOUCHE NE RESTE PAS À LA MÊME HAUTEUR. C'est le défaut qui a fait
 *    échouer les premières soirées : mesuré à 210 px du haut sur une capture,
 *    il se trouvait 85 px plus haut sur une autre de la même partie — le bloc
 *    du coin descend quand une bannière s'ajoute au-dessus. Une zone fixe lisait
 *    alors l'affichage de performance à sa place, et un « ping : 36 ms » se
 *    serait enregistré comme trente-six éliminations. La hauteur se repère
 *    donc à chaque lecture, sur la bannière des escouades restantes, et les
 *    chiffres se lisent à distance constante d'elle.
 */

/**
 * Les distances sont exprimées en HAUTEURS D'ÉCRAN, comptées depuis le bord
 * droit — pas en proportion de la largeur.
 *
 * L'interface d'Apex est calée sur le bord droit et grandit avec la hauteur.
 * Une proportion de largeur ferait glisser toutes les zones sur un écran 16:9,
 * là où cette forme-ci les laisse où elles sont. Reste à le vérifier sur un tel
 * écran : la mesure, elle, n'a été faite qu'en 3440×1440.
 */
const H_REF = 1440;

/** Bande où chercher la bannière « N ESCOUADES RESTANTES ». */
const BANDE_ANCRE = {
  droite0: 600 / H_REF,
  droite1: 170 / H_REF,
  haut0: 0,
  haut1: 0.28,
  echelle: 2,
  modes: ["11"],
  /**
   * Le mot suffit, dans les deux langues où il a été vu. Une interface dans une
   * langue plus lointaine ne s'ancrera pas — la lecture rendra « rien à lire »
   * plutôt qu'un chiffre faux, ce qui est la bonne façon d'échouer.
   */
  motif: /ESCOUAD|SQUAD/i,
};

/**
 * Le cartouche, repéré par rapport au bas de la bannière.
 *
 * `dy0`/`dy1` sont les bords haut et bas des chiffres, comptés depuis le haut
 * du mot « ESCOUADES ». Les colonnes, elles, ne bougent pas : le bloc est calé
 * sur le bord droit de l'écran.
 */
const CARTOUCHE = {
  // La bande, comptée depuis le bord droit, et sa hauteur sous la bannière.
  droite0: 560 / H_REF,
  droite1: 218 / H_REF,
  dy0: 50 / H_REF,
  dy1: 82 / H_REF,

  echelle: 6,
  alphabet: "0123456789",
  modes: ["8", "10", "13"],

  /**
   * Comment les chiffres se distinguent du reste, à la largeur de leurs traits.
   *
   * Sur une colonne de la bande, il y a de l'encre ou il n'y en a pas. Les
   * traits verticaux ainsi formés se trient par largeur : un chiffre en fait
   * onze à treize, une icône vingt-cinq à trente-huit, la pointe d'un
   * parallélogramme dix-huit. Au-delà de seize, ce n'est donc pas un chiffre.
   *
   * C'est ce tri qui a remplacé les colonnes fixes, et il fallait le faire :
   * d'une capture à l'autre de la même partie, le bloc glissait de sept pixels
   * — le cartouche est calé sur le bord droit du nombre de dégâts, pas sur le
   * bord gauche du crâne. Une colonne fixe attrapait alors la queue rose de
   * l'icône avec le nombre, et rendait « 12164 » pour 2164.
   */
  largeurMaxChiffre: 16 / H_REF,
  largeurMinTrait: 3 / H_REF,
  /** Deux traits plus proches que cela appartiennent au même nombre. */
  ecartDansUnNombre: 8 / H_REF,
  /** Au-dessus de quoi un pixel compte comme de l'encre, sur son canal le plus vif. */
  seuilEncre: 185,
};

const ZONES = {
  /**
   * Écran de fin : « CLASSEMENT : N° 7 ».
   *
   * La lecture rend le texte complet, ce qui sert deux fois : le dernier nombre
   * est le classement, et la présence du mot confirme qu'on est bien sur cet
   * écran-là plutôt que sur un menu qui passait par là.
   */
  classement: {
    x: 1100 / 3440, y: 655 / H_REF, w: 1250 / 3440, h: 130 / H_REF,
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
};

/**
 * Ce qu'ont donné les mesures, gardé pour qu'une régression se voie.
 *
 * Vingt-six captures de la même soirée ont servi : deux portent le cartouche,
 * vingt-quatre ne le portent pas — c'est la moitié qui compte le plus. Apex
 * n'affiche le cartouche qu'à partir du premier dégât de l'escouade ; une
 * lecture qui « trouve » un chiffre sur les vingt-quatre autres invente.
 */
const REFERENCE = {
  "19h56m14s": { classement: 7 },
  "19h56m19s": { eliminations: 8, assistances: 3, degats: 2164 },
  "19h56m29s": { eliminations: 8, assistances: 3, degats: 2336 },
  "19h50m45s": { cartouche: null },
  "19h51m06s": { cartouche: null },
};

module.exports = { ZONES, BANDE_ANCRE, CARTOUCHE, REFERENCE };
