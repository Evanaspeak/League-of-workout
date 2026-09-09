import { lireCorps } from "./corpsRequete";

/**
 * Le module que dix-neuf routes appellent, éprouvé en l'EXÉCUTANT.
 *
 * Il n'avait aucun test à lui. Ce qui le tenait était une paire de motifs lus
 * dans sa propre source — `catch { return null; }` et `Array.isArray(brut)` —
 * c'est-à-dire un contrôle qui éprouve le MOTIF et non la RÈGLE. Le journal
 * porte déjà ce défaut sous deux formes ; celle-ci laissait un trou complet.
 *
 * Mesuré : la condition de TYPE retirée, le motif restait satisfait et
 * **2854 tests passaient au vert**. La porte d'entrée du produit répondait
 * alors « Pseudo manquant » sur un corps qui est un nombre, une chaîne ou un
 * booléen — c'est-à-dire qu'elle accusait la saisie de quelqu'un d'un défaut
 * qui n'est pas le sien, ce que ce module existe précisément pour empêcher.
 *
 * DEUX des trois conditions ont un cas qui les distingue, et c'est le
 * sabotage qui a dit laquelle n'en a pas :
 *
 * - `Array.isArray` seul attrape le tableau, dont le `typeof` vaut aussi
 *   « object » ;
 * - `typeof brut !== "object"` seul attrape le nombre, la chaîne et le
 *   booléen. C'est celle qui manquait au motif, et celle qui coûtait ;
 * - **`brut === null` n'est distinguable ni par un test ni par le
 *   compilateur.** Retirée, `null` ne passe plus par le refus mais par le
 *   chemin de succès — et ce chemin rend `brut`, c'est-à-dire `null`. La
 *   valeur reçue par l'appelant est la même, et `tsc` se tait sur le `as T`.
 *   Le cas est éprouvé quand même parce qu'il éprouve le CONTRAT — un corps
 *   `null` vaut refus — mais il ne prouve rien de l'implémentation, et le
 *   prétendre serait exactement ce que ce fichier reproche au motif qu'il
 *   remplace.
 */
const corps = (brut: string) =>
  new Request("https://exemple.test/api/x", { method: "POST", body: brut });

describe("lireCorps", () => {
  it("rend l'objet tel quel, sans rien transformer", async () => {
    const attendu = { pseudo: "Kayn", niveau: 3, options: { boxe: true }, liste: [1, 2] };
    await expect(lireCorps(corps(JSON.stringify(attendu)))).resolves.toEqual(attendu);
  });

  /**
   * Un objet VIDE est un objet, donc il passe.
   *
   * Le refuser serait tentant et faux : c'est à la route de dire quel champ
   * manque, avec le message qui va avec. « Corps illisible » sur un `{}`
   * parfaitement formé enverrait chercher une panne de réseau là où il n'y a
   * qu'un champ oublié.
   */
  it("laisse passer un objet vide, que la route refusera par son propre message", async () => {
    await expect(lireCorps(corps("{}"))).resolves.toEqual({});
  });

  it("rend null sur un corps tronqué — l'octet perdu qui a motivé le module", async () => {
    await expect(lireCorps(corps('{"pseudo":'))).resolves.toBeNull();
  });

  it("rend null sur un corps vide", async () => {
    await expect(lireCorps(corps(""))).resolves.toBeNull();
  });

  it("rend null sur du texte qui n'est pas du JSON", async () => {
    await expect(lireCorps(corps("<html>503</html>"))).resolves.toBeNull();
  });

  // Le contrat, pas l'implémentation : voir l'en-tête.
  it("rend null sur le littéral null, dont le typeof vaut « object »", async () => {
    await expect(lireCorps(corps("null"))).resolves.toBeNull();
  });

  it("rend null sur un tableau, dont le typeof vaut « object » aussi", async () => {
    await expect(lireCorps(corps("[1,2,3]"))).resolves.toBeNull();
  });

  it.each([
    ["un nombre", "42"],
    ["une chaîne", '"abc"'],
    ["un booléen", "true"],
  ])("rend null sur %s", async (_nom, brut) => {
    await expect(lireCorps(corps(brut))).resolves.toBeNull();
  });

  /**
   * Le cas qui coûte le plus, et le moins évident.
   *
   * Une chaîne PORTE des propriétés : `"abc".length` vaut 3. Sans le contrôle
   * de type, `lireCorps` la rendrait telle quelle, et une route qui lit un
   * champ homonyme en tirerait une valeur — donc un chiffre venu de nulle part
   * au lieu d'un refus.
   */
  it("ne laisse pas une chaîne se faire passer pour un objet à propriétés", async () => {
    const lu = await lireCorps<{ length?: number }>(corps('"abc"'));
    expect(lu).toBeNull();
    expect(lu?.length).toBeUndefined();
  });

  /**
   * Il ne LÈVE jamais, quelle que soit l'entrée.
   *
   * C'est la seule chose que les dix-neuf appelants tiennent pour acquise : un
   * jet ici ferait rendre 500 à la route, c'est-à-dire exactement ce que le
   * module existe pour empêcher.
   */
  it("ne lève jamais, y compris sur un corps déjà consommé", async () => {
    const r = corps('{"a":1}');
    await r.json();
    await expect(lireCorps(r)).resolves.toBeNull();
  });
});
