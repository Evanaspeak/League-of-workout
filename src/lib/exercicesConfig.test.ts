/**
 * Le barème d'un COMPTE (réponse 047, « Oui, par utilisateur »).
 *
 * Ce qui est éprouvé ici n'est pas l'arithmétique — `quantite` a ses propres
 * tests — mais les trois décisions qui font qu'un barème personnel ne casse
 * rien : ce qu'il complète, ce qu'il refuse, et ce qu'il ne touche JAMAIS.
 */
import { RATIOS_DEFAUT, RATIO_BORNES, fusionnerRatios, parseRatiosPerso } from "@/lib/exercices";

describe("fusionnerRatios", () => {
  it("garde le barème commun pour tout ce qui n'est pas réglé", () => {
    // C'est ce qui rend la colonne sans effet sur les comptes existants : un
    // compte qui n'a jamais ouvert ce réglage se comporte exactement comme
    // avant, exercice par exercice.
    expect(fusionnerRatios(RATIOS_DEFAUT, null)).toEqual(RATIOS_DEFAUT);
    expect(fusionnerRatios(RATIOS_DEFAUT, {})).toEqual(RATIOS_DEFAUT);
  });

  it("ne remplace QUE les exercices réglés", () => {
    const fusion = fusionnerRatios(RATIOS_DEFAUT, { boxe: 12 });
    expect(fusion.boxe).toBe(12);
    // Le témoin : sans lui, un barème personnel qui écraserait tout le reste
    // passerait ce test en n'ayant regardé qu'une valeur.
    expect(fusion.squats).toBe(RATIOS_DEFAUT.squats);
    expect(fusion.course).toBe(RATIOS_DEFAUT.course);
  });

  /**
   * Les pompes sont l'unité de référence : un point d'effort vaut une pompe
   * depuis le premier jour, et `Game.pompesCalculees` compte des points sous
   * ce nom. Les laisser régler ne changerait pas la difficulté d'un exercice,
   * ça changerait le sens du registre entier.
   *
   * **Ce contrôle-ci ne DISTINGUE pas, et c'est le sabotage qui l'a dit.**
   * Ouvrir la boucle à tous les exercices le laisse passer : `RATIO_BORNES`
   * borne déjà les pompes à `{ min: 1, max: 1 }`, donc l'arithmétique les
   * ramène à un quoi qu'on fasse. Les deux gardes coïncident ici, et aucun jeu
   * de données ne peut les séparer.
   *
   * Ce qui les sépare vit ailleurs, et les deux mordent : `parseRatiosPerso`,
   * qui rend un objet PARTIEL — les pompes y apparaîtraient — et la route de
   * réglages, qui REFUSE la clé au lieu de la ramener en silence. Cette
   * assertion reste pour ce qu'elle vaut : la propriété est vraie, et elle est
   * écrite là où on la cherche.
   */
  it("ne laisse jamais régler les pompes", () => {
    expect(fusionnerRatios(RATIOS_DEFAUT, { pompes: 4 }).pompes).toBe(RATIOS_DEFAUT.pompes);
  });

  it("ramène une valeur hors bornes dans les bornes, exercice par exercice", () => {
    // Ce qui est en base doit rester LISIBLE : c'est la route de réglages qui
    // refuse à l'écriture, ici on lit ce qui existe déjà. Une valeur héritée
    // d'un ancien réglage ne doit pas rendre la dette incalculable.
    const { min, max } = RATIO_BORNES.boxe;
    expect(fusionnerRatios(RATIOS_DEFAUT, { boxe: 1e9 }).boxe).toBe(max);
    expect(fusionnerRatios(RATIOS_DEFAUT, { boxe: -3 }).boxe).toBe(min);
  });

  it("ignore ce qui n'est pas un nombre, sans emporter les voisins", () => {
    const fusion = fusionnerRatios(RATIOS_DEFAUT, { boxe: "beaucoup", squats: 3 });
    expect(fusion.boxe).toBe(RATIOS_DEFAUT.boxe);
    expect(fusion.squats).toBe(3);
  });

  /**
   * La colonne est un `String?` : ce qui arrive de la base est une CHAÎNE.
   *
   * La fusion portait sa propre boucle, qui ne lisait que les objets — donc le
   * barème personnel était ignoré et le commun s'appliquait, sans erreur et
   * sans qu'aucun test unitaire le voie, puisqu'ils lui passaient tous des
   * objets. C'est le parcours navigateur qui l'a dit, en lisant la dette après
   * le réglage : la base portait `{"boxe":5.4}` et la route rendait 100 s au
   * lieu de 180.
   */
  it("lit le barème tel qu'il sort de la base, c'est-à-dire une chaîne", () => {
    expect(fusionnerRatios(RATIOS_DEFAUT, '{"boxe":12}').boxe).toBe(12);
  });

  it("part du barème qu'on lui donne, pas des valeurs d'origine", () => {
    // Le barème commun est réglable en administration : partir de
    // `RATIOS_DEFAUT` ferait perdre ce réglage-là à tous les comptes qui ont
    // touché un seul exercice.
    const commun = { ...RATIOS_DEFAUT, squats: 9, boxe: 30 };
    const fusion = fusionnerRatios(commun, { boxe: 12 });
    expect(fusion.squats).toBe(9);
    expect(fusion.boxe).toBe(12);
  });
});

describe("parseRatiosPerso", () => {
  it("rend un objet PARTIEL : seulement ce que la personne a réglé", () => {
    // C'est ce que l'écran des réglages doit montrer. Un jeu complet ne dirait
    // plus ce qui vient de la personne et ce qui vient du barème commun.
    expect(parseRatiosPerso('{"boxe":12}')).toEqual({ boxe: 12 });
  });

  it("lit aussi bien une chaîne qu'un objet", () => {
    expect(parseRatiosPerso({ squats: 3 })).toEqual({ squats: 3 });
  });

  it("rend un objet vide sur tout ce qui ne se lit pas", () => {
    for (const brut of [null, undefined, "{pas du JSON", "[]", 42, '"boxe"']) {
      expect(parseRatiosPerso(brut)).toEqual({});
    }
  });

  it("écarte les pompes et les exercices inconnus", () => {
    expect(parseRatiosPerso('{"pompes":4,"trapeze":2,"boxe":8}')).toEqual({ boxe: 8 });
  });
});
