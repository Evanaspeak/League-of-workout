/**
 * Ce qu'une saisie DÉSIGNE, et le classement des propositions.
 *
 * « Taper « r » doit d'abord donner Rakan et Renekton, pas Aatrox » : c'est la
 * règle du champ d'autocomplétion, elle décide de ce qu'on voit en tapant, et
 * rien ne la tenait. Et l'aplatissement compte autant : on tape rarement
 * l'apostrophe de Cho'Gath ni l'accent de Bel'Veth, et un champ qui exige la
 * ponctuation exacte du nom n'aide personne.
 *
 * Ces fonctions sont pures — elles ne connaissent que la liste qu'on leur
 * passe — et c'est ce qui permet à la porte d'écriture de les appeler. Le
 * crochet React et la mémoire de la liste vivent dans `useChampions.ts` et
 * ont leur propre fichier.
 */
import {
  ALIAS_CHAMPIONS, CHAMPIONS, CLE_DATA_DRAGON, championConnu, cleDataDragon,
  resoudreChampion, suggererChampions,
} from "@/lib/champions";

describe("championConnu", () => {
  it("accepte le nom exact", () => {
    expect(championConnu(CHAMPIONS, "Ahri")).toBe(true);
  });

  it("ignore la casse et les espaces autour", () => {
    expect(championConnu(CHAMPIONS, "  ahri ")).toBe(true);
    expect(championConnu(CHAMPIONS, "AHRI")).toBe(true);
  });

  /**
   * L'apostrophe, elle, compte : c'est un contrôle de validité, pas une
   * recherche. Accepter « chogath » ici ferait entrer en base un nom qui
   * n'existe pas, et l'icône du champion se chargerait sur un nom inconnu.
   */
  it("refuse un nom hors liste", () => {
    expect(championConnu(CHAMPIONS, "Chogath")).toBe(false);
    expect(championConnu(CHAMPIONS, "")).toBe(false);
    expect(championConnu(CHAMPIONS, "Sylas le Grand")).toBe(false);
  });
});

describe("suggererChampions", () => {
  it("ne propose rien sur une requête vide", () => {
    expect(suggererChampions(CHAMPIONS, "")).toEqual([]);
    expect(suggererChampions(CHAMPIONS, "   ")).toEqual([]);
  });

  /**
   * La promesse du commentaire, prise au mot — sur une liste FABRIQUÉE.
   *
   * La première version de ce test lisait la vraie liste : « r » y rendait
   * Rakan en tête et pas Aatrox, ce qui semblait prouver le classement. Ça ne
   * prouvait rien. Sabotage fait, le rang 0 retiré, le test restait vert : une
   * centaine de champions commencent par « r », ils passent tous au rang 1, et
   * les huit places sont prises bien avant qu'un Aatrox de rang 2 arrive. La
   * limite faisait le travail que le classement était censé faire.
   *
   * Ici les trois rangs ont un membre chacun, et surtout l'ordre ALPHABÉTIQUE
   * des trois est l'inverse du classement attendu. C'est ce qui les sépare :
   * la deuxième version du test employait « Zed Rasp » au rang 1, qui se range
   * après « Rakan » de toute façon — effacer le rang 0 les mettait tous deux
   * au rang 1 sans changer une ligne du résultat, et le sabotage repassait au
   * vert. Un rang ne se prouve que par un cas où son absence déplace quelque
   * chose.
   */
  it("classe début de nom, puis début de mot, puis simple présence", () => {
    // « Rakan » commence par la requête, « Braum Rasp » l'a en début de second
    // mot, « Aurora » la contient au milieu. Dans l'alphabet : Aurora, Braum,
    // Rakan — soit exactement l'inverse.
    const liste = ["Aurora", "Braum Rasp", "Rakan"];
    expect(suggererChampions(liste, "ra")).toEqual(["Rakan", "Braum Rasp", "Aurora"]);
  });

  /** Et ce qui ne contient pas la requête du tout ne paraît pas. */
  it("écarte ce qui ne contient pas la requête", () => {
    expect(suggererChampions(["Rakan", "Ahri"], "ra")).toEqual(["Rakan"]);
  });

  /** Deuxième rang : le début d'un MOT du nom, pour les noms composés. */
  it("trouve un champion par le second mot de son nom", () => {
    expect(suggererChampions(CHAMPIONS, "sol")).toContain("Aurelion Sol");
    expect(suggererChampions(CHAMPIONS, "kaisa")).toContain("Kai'Sa");
  });

  it("trouve malgré l'apostrophe et l'accent", () => {
    expect(suggererChampions(CHAMPIONS, "chogath")).toContain("Cho'Gath");
    expect(suggererChampions(CHAMPIONS, "velkoz")).toContain("Vel'Koz");
    expect(suggererChampions(CHAMPIONS, "kogmaw")).toContain("Kog'Maw");
  });

  it("respecte la limite demandée", () => {
    expect(suggererChampions(CHAMPIONS, "a").length).toBeLessThanOrEqual(8);
    expect(suggererChampions(CHAMPIONS, "a", 3)).toHaveLength(3);
  });

  /**
   * À pertinence égale, l'ordre alphabétique — sinon l'ordre de la liste
   * décide, c'est-à-dire rien de lisible pour qui lit les propositions.
   *
   * La liste d'entrée est donnée À L'ENVERS de l'alphabet, exprès. La première
   * version lisait la vraie liste, qui est déjà triée : le tri de V8 étant
   * stable, retirer la comparaison ne changeait rien et le test restait vert.
   * Il éprouvait l'ordre du fichier `champions.ts`, pas le comparateur.
   */
  it("range par ordre alphabétique à rang égal", () => {
    const liste = ["Karthus", "Kassadin", "Karma"];
    expect(suggererChampions(liste, "ka")).toEqual(["Karma", "Karthus", "Kassadin"]);
  });

  /** Un nom qui n'existe pas ne rend rien plutôt que la liste entière. */
  it("ne propose rien sur une requête introuvable", () => {
    expect(suggererChampions(CHAMPIONS, "zzzzz")).toEqual([]);
  });
});

describe("resoudreChampion", () => {
  it("rend le nom canonique tel quel", () => {
    expect(resoudreChampion(CHAMPIONS, "Ahri")).toBe("Ahri");
    expect(resoudreChampion(CHAMPIONS, "  ahri  ")).toBe("Ahri");
  });

  it("ramène une saisie aplatie à sa forme canonique", () => {
    // C'est le défaut corrigé : la liste PROPOSAIT « Cho'Gath » à qui tape
    // « Chogath », et le bouton d'enregistrement le REFUSAIT.
    expect(resoudreChampion(CHAMPIONS, "Chogath")).toBe("Cho'Gath");
    expect(resoudreChampion(CHAMPIONS, "kaisa")).toBe("Kai'Sa");
    expect(resoudreChampion(CHAMPIONS, "dr mundo")).toBe("Dr. Mundo");
  });

  it("ramène les accents des noms localisés qui n'en sont que la variante", () => {
    // Mesuré contre Data Dragon : ces quatre-là se ramènent tout seuls, sans
    // alias, parce que ce sont des variantes typographiques et non des
    // traductions.
    expect(resoudreChampion(CHAMPIONS, "Séraphine")).toBe("Seraphine");
    expect(resoudreChampion(CHAMPIONS, "Zoé")).toBe("Zoe");
    expect(resoudreChampion(CHAMPIONS, "K'Santé")).toBe("K'Sante");
    expect(resoudreChampion(CHAMPIONS, "Jarvan IV.")).toBe("Jarvan IV");
  });

  it("ramène les noms réellement TRADUITS par la table d'alias", () => {
    expect(resoudreChampion(CHAMPIONS, "Maître Yi")).toBe("Master Yi");
    expect(resoudreChampion(CHAMPIONS, "Maestro Yi")).toBe("Master Yi");
    expect(resoudreChampion(CHAMPIONS, "Bardo")).toBe("Bard");
    expect(resoudreChampion(CHAMPIONS, "Nunu et Willump")).toBe("Nunu & Willump");
    expect(resoudreChampion(CHAMPIONS, "Nunu y Willump")).toBe("Nunu & Willump");
  });

  it("ne devine pas quand la saisie ne désigne personne", () => {
    expect(resoudreChampion(CHAMPIONS, "Sylas le Grand")).toBeNull();
    expect(resoudreChampion(CHAMPIONS, "")).toBeNull();
    expect(resoudreChampion(CHAMPIONS, "   ")).toBeNull();
    expect(resoudreChampion(CHAMPIONS, "'''")).toBeNull();
  });

  it("n'invente pas un alias dont la cible a quitté la liste", () => {
    // L'admin peut retirer un champion de la liste. L'alias ne doit pas le
    // faire revenir par la bande : le formulaire enregistrerait un nom que la
    // liste refuse.
    const sansYi = CHAMPIONS.filter((c) => c !== "Master Yi");
    expect(resoudreChampion(sansYi, "Maître Yi")).toBeNull();
  });

  it("aucun champion n'en désigne un autre une fois aplati", () => {
    // La résolution refuse de choisir entre deux candidats — donc si deux
    // champions s'aplatissaient pareil, les deux deviendraient insaisissables.
    // C'est vrai aujourd'hui ; c'est le jour où Riot en ajoute un que ça
    // changerait, et ce contrôle le dira.
    const insaisissables = CHAMPIONS.filter((c) => resoudreChampion(CHAMPIONS, c) !== c);
    expect(insaisissables).toEqual([]);
  });

  it("refuse de choisir entre deux champions qui s'aplatissent pareil", () => {
    // Le cas se prouve sur une liste FABRIQUÉE : aucun couple de la vraie
    // liste ne collisionne aujourd'hui, donc elle ne peut pas distinguer une
    // résolution qui refuse d'une résolution qui prend le premier venu. Cette
    // branche existe pour le jour où Riot ajoute un nom qui collisionne — et
    // ce jour-là, deviner enregistrerait une partie qu'on n'a pas jouée.
    const collision = ["Kai'Sa", "Kai-Sa"];
    expect(resoudreChampion(collision, "kaisa")).toBeNull();
    // La forme EXACTE, elle, continue de passer : c'est la première règle, et
    // c'est ce qui distingue « je ne sais pas lequel » de « je refuse tout ».
    expect(resoudreChampion(collision, "Kai'Sa")).toBe("Kai'Sa");
    expect(resoudreChampion(collision, "kai-sa")).toBe("Kai-Sa");
  });

  it("chaque alias désigne un champion qui existe, et un seul", () => {
    for (const [localise, canonique] of Object.entries(ALIAS_CHAMPIONS)) {
      expect(CHAMPIONS).toContain(canonique);
      // Un alias qui serait DÉJÀ un champion ne servirait à rien et cacherait
      // le vrai : la résolution exacte passe avant lui.
      expect(resoudreChampion(CHAMPIONS, localise)).toBe(canonique);
    }
    expect(Object.keys(ALIAS_CHAMPIONS).length).toBeGreaterThanOrEqual(5);
  });
});

describe("les suggestions connaissent les noms traduits", () => {
  it("propose le nom canonique à qui tape le nom français", () => {
    // Sans ça le champ reste MUET : « Maî » ne ressemble à aucun nom anglais.
    expect(suggererChampions(CHAMPIONS, "Maître")).toContain("Master Yi");
    expect(suggererChampions(CHAMPIONS, "Bardo")).toContain("Bard");
    expect(suggererChampions(CHAMPIONS, "Nunu et")).toContain("Nunu & Willump");
  });

  it("ne propose jamais le nom traduit lui-même", () => {
    // C'est le nom canonique qu'on enregistre : proposer « Maître Yi » puis
    // stocker « Master Yi » ferait deux vérités à l'écran.
    expect(suggererChampions(CHAMPIONS, "Maître")).not.toContain("Maître Yi");
  });

  it("ne propose pas deux fois le même champion", () => {
    const s = suggererChampions(CHAMPIONS, "bard");
    expect(s.length).toBe(new Set(s).size);
  });

  it("ne propose pas un alias dont la cible a quitté la liste", () => {
    const sansBard = CHAMPIONS.filter((c) => c !== "Bard");
    expect(suggererChampions(sansBard, "Bardo")).toEqual([]);
  });
});

/**
 * La clé Data Dragon décide de l'ICÔNE, et une clé fausse ne casse rien : elle
 * rend une image qui 404, donc le repli en lettre. Personne ne le remarque
 * avant des semaines.
 *
 * Ce qui se vérifie ici est la cohérence INTERNE, parce qu'elle ne demande
 * aucun réseau. La justesse des clés, elle, se mesure contre Data Dragon —
 * relevé le 9 septembre sur 16.17.1 : les cent soixante-treize sont bonnes.
 */
describe("la clé Data Dragon", () => {
  it("ne porte aucune entrée sans effet", () => {
    const inutiles = Object.entries(CLE_DATA_DRAGON).filter(([nom, cle]) => nom === cle);
    expect(inutiles).toEqual([]);
  });

  it("ne désigne que des champions de la liste", () => {
    const inconnus = Object.keys(CLE_DATA_DRAGON).filter((n) => !CHAMPIONS.includes(n));
    expect(inconnus).toEqual([]);
  });

  /**
   * Deux champions qui partagent une clé partagent une icône, et rien ne le
   * dit — les deux images se chargent.
   */
  it("ne fait jamais tomber deux champions sur la même", () => {
    const vus = new Map<string, string>();
    const collisions: string[] = [];
    for (const nom of CHAMPIONS) {
      const cle = cleDataDragon(nom);
      const deja = vus.get(cle);
      if (deja) collisions.push(`${nom} et ${deja} → ${cle}`);
      else vus.set(cle, nom);
    }
    expect(collisions).toEqual([]);
    expect(vus.size).toBe(CHAMPIONS.length); // témoin : la boucle a bien tourné
  });

  /**
   * Le repli mécanique et la table se partagent le travail : celui-là suffit
   * quand Riot garde la majuscule du second morceau, celle-ci reprend la main
   * quand il la met en minuscule. Les deux cas sont éprouvés, sans quoi on ne
   * saurait pas laquelle des deux moitiés fait quoi.
   */
  it("retire la ponctuation quand ça suffit, et consulte la table sinon", () => {
    expect(cleDataDragon("K'Sante")).toBe("KSante");
    expect(cleDataDragon("Lee Sin")).toBe("LeeSin");
    expect(cleDataDragon("Cho'Gath")).toBe("Chogath");
    expect(cleDataDragon("Wukong")).toBe("MonkeyKing");
    expect(cleDataDragon("Ahri")).toBe("Ahri");
  });
});
