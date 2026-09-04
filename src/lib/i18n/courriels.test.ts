import { lignesBilan, textesBilan } from "./courriels";
import { etiquetteLocale, LANGUES, type Locale } from "./langues";
import type { Bilan } from "../bilanHebdo";

/**
 * Les quatre chiffres du bilan hebdomadaire.
 *
 * C'est le SEUL message que le produit envoie de lui-même, et donc le seul
 * endroit où personne ne peut aller vérifier ailleurs ce qu'il lit. Deux
 * défauts y vivaient, tous deux invisibles à qui écrit l'application en
 * français :
 *
 * - l'effort partait en `String(n)` — « 5150 » dans les six langues, là où le
 *   français écrit « 5 150 », l'allemand « 5.150 » et le japonais « 5,150 » ;
 * - les initiales de victoire et de défaite étaient écrites « V » et « D »
 *   dans le module, donc en français partout. Un lecteur anglais lisait
 *   « 12 (7V / 5D) » sans que rien ne dise ce que ces lettres désignent.
 *   L'espagnol tombait juste par hasard, ce qui est la façon la plus discrète
 *   pour un défaut de survivre à une relecture.
 */

const BILAN: Bilan = {
  parties: 12, victoires: 7, defaites: 5,
  pointsDus: 5150, pointsPayes: 3200, joursActifs: 4,
} as Bilan;

const ligne = (l: Locale, libelle: string) => {
  const t = textesBilan(l);
  const lignes = lignesBilan(t, BILAN, etiquetteLocale(l));
  return lignes.find((x) => x.libelle === libelle)?.valeur ?? "";
};

describe("les chiffres du bilan hebdomadaire", () => {
  it("groupe les milliers selon la langue du compte", () => {
    // Trois séparateurs VISIBLES, choisis exprès : l'espace fine insécable du
    // français se lit comme rien du tout quand on parcourt vite, et c'est ce
    // qui a laissé vivre le défaut. L'allemand et le japonais, eux, le disent.
    expect(ligne("fr", textesBilan("fr").effort)).toBe("5 150");
    expect(ligne("de", textesBilan("de").effort)).toBe("5.150");
    expect(ligne("ja", textesBilan("ja").effort)).toBe("5,150");
    expect(ligne("en", textesBilan("en").paye)).toBe("3,200");
  });

  it("écrit les initiales de victoire et de défaite dans chaque langue", () => {
    expect(ligne("fr", textesBilan("fr").parties)).toBe("12 (7V / 5D)");
    expect(ligne("en", textesBilan("en").parties)).toBe("12 (7W / 5L)");
    expect(ligne("de", textesBilan("de").parties)).toBe("12 (7S / 5N)");
    expect(ligne("ja", textesBilan("ja").parties)).toBe("12 (7勝 / 5敗)");
  });

  it("ne laisse aucune langue sans initiales", () => {
    // Témoin : sans lui, une langue dont les deux initiales seraient vides
    // rendrait « 12 (7 / 5) » sans que rien ne tombe — les deux contrôles
    // au-dessus ne regardent que quatre langues sur six.
    expect(LANGUES.length).toBe(6);
    for (const l of LANGUES) {
      const t = textesBilan(l);
      expect(t.victoire.trim()).not.toBe("");
      expect(t.defaite.trim()).not.toBe("");
      expect(t.victoire).not.toBe(t.defaite);
    }
  });
});
