/**
 * Le classement des propositions, qui est une promesse écrite en commentaire.
 *
 * « Taper « r » doit d'abord donner Rakan et Renekton, pas Aatrox » : c'est la
 * règle du champ d'autocomplétion, elle décide de ce qu'on voit en tapant, et
 * rien ne la tenait. Le fichier n'était atteint par aucun test — ni celui-ci
 * ni ceux de `ChampionInput`, qui doublent le module entier.
 *
 * Ce qui est éprouvé, c'est le classement ET l'aplatissement : on tape
 * rarement l'apostrophe de Cho'Gath ni l'accent de Bel'Veth, et un champ qui
 * exige la ponctuation exacte du nom n'aide personne.
 *
 * Les deux fonctions sont pures ; le crochet React et la mémoire de la liste
 * ne le sont pas et restent couverts par les parcours navigateur.
 */
import { CHAMPIONS } from "@/lib/champions";
import {
  championConnu, chargerChampions, invaliderChampions, suggererChampions,
} from "@/lib/useChampions";

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

/**
 * Ce que devient la liste quand `/api/champions` ne répond pas.
 *
 * L'enjeu n'est pas l'affichage : c'est que la MÊME liste sert à valider. Un
 * échec figé, c'est un champion ajouté par l'admin refusé par le formulaire,
 * bouton d'enregistrement éteint, avec un message qui accuse la frappe.
 */
describe("chargement de la liste", () => {
  const vraiFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = vraiFetch; invaliderChampions(); });

  it("retombe sur la liste codée en dur quand l'appel échoue", async () => {
    globalThis.fetch = jest.fn(() => Promise.reject(new Error("hors ligne"))) as never;
    await expect(chargerChampions()).resolves.toEqual(CHAMPIONS);
  });

  /**
   * Le cœur : l'échec ne se mémorise pas. Le premier appel échoue, le second
   * doit REPARTIR au réseau — sans quoi la liste codée en dur tient jusqu'au
   * prochain rechargement de page.
   */
  it("retente après un échec au lieu de figer la liste", async () => {
    const appels = jest.fn()
      .mockImplementationOnce(() => Promise.reject(new Error("hors ligne")))
      .mockImplementationOnce(() => Promise.resolve({
        json: () => Promise.resolve(["Ahri", "Zoé la Nouvelle"]),
      }));
    globalThis.fetch = appels as never;

    await expect(chargerChampions()).resolves.toEqual(CHAMPIONS);
    await expect(chargerChampions()).resolves.toEqual(["Ahri", "Zoé la Nouvelle"]);
    expect(appels).toHaveBeenCalledTimes(2);
  });

  /** Une réussite, elle, se mémorise : un seul appel pour toute la page. */
  it("ne demande la liste qu'une fois quand l'appel réussit", async () => {
    const appels = jest.fn(() => Promise.resolve({
      json: () => Promise.resolve(["Ahri", "Zed"]),
    }));
    globalThis.fetch = appels as never;

    await chargerChampions();
    await chargerChampions();
    expect(appels).toHaveBeenCalledTimes(1);
  });

  /** Une réponse vide ou d'une autre forme ne remplace pas la liste. */
  it("ignore une réponse qui n'est pas une liste de champions", async () => {
    globalThis.fetch = jest.fn(() => Promise.resolve({
      json: () => Promise.resolve({ error: "Non authentifié" }),
    })) as never;
    await expect(chargerChampions()).resolves.toEqual(CHAMPIONS);
  });
});
