import { decrireEvolution, decrireRepartition } from "./ResumeGraphique";
import { dashboard } from "@/lib/i18n/dictionaries/dashboard";

/**
 * Le résumé qu'un lecteur d'écran lit à la place d'un graphique.
 *
 * C'est la seule forme sous laquelle ces chiffres existent pour qui ne voit
 * pas la courbe — et c'est aussi la surface la moins relue du produit, parce
 * que personne ne l'entend en développant. Deux défauts y vivaient :
 *
 * - l'énumération se joignait par `", "` dans les six langues, alors que la
 *   phrase qui l'entoure finit par « 。 » en japonais : on lisait
 *   « 月 8, 火 8, 水 8。 », une virgule latine au milieu d'idéogrammes ;
 * - au-delà de huit barres, le repli composait « 12 — 5 … 20 » avec un tiret
 *   CADRATIN, la ponctuation que ce projet refuse partout où quelqu'un lit.
 *   Le garde des dictionnaires ne pouvait pas le voir : cette phrase se
 *   compose dans un composant.
 */

const fmt = (v: number) => String(v);

describe("l'énumération d'une répartition", () => {
  const points = [
    { label: "lun.", pompes: 8 },
    { label: "mar.", pompes: 12 },
  ];

  it("emploie le séparateur qu'on lui donne", () => {
    expect(decrireRepartition(points, "label", "pompes", fmt, "、")).toBe("lun. 8、mar. 12");
    expect(decrireRepartition(points, "label", "pompes", fmt, ", ")).toBe("lun. 8, mar. 12");
  });

  /**
   * Et les six langues en déclarent un.
   *
   * Le séparateur vient du dictionnaire parce qu'`Intl.ListFormat` ne sait pas
   * le donner — mesuré : avec `type: "unit"` il rend « A 8 B 12 » en japonais
   * et « A 8B 12 » en chinois, c'est-à-dire rien. Ces listes-là sont faites
   * pour « 5 ft 3 in ». Le contrôle vérifie donc que chaque langue a fait son
   * choix, et que les deux écritures idéographiques ne se contentent pas de
   * la virgule latine.
   */
  it("chaque langue déclare le sien, et l'idéographique n'est pas latin", () => {
    for (const langue of Object.keys(dashboard)) {
      expect(typeof (dashboard as Record<string, { separateurListe?: unknown }>)[langue].separateurListe)
        .toBe("string");
    }
    expect(dashboard.ja.separateurListe).toBe("、");
    expect(dashboard.zh.separateurListe).toBe("、");
    expect(dashboard.fr.separateurListe).toBe(", ");
  });

  it("sans langue, rend exactement ce qu'il rendait", () => {
    // Le repli garde la virgule latine : c'est ce qui rend la reprise des
    // appelants sûre un par un.
    expect(decrireRepartition(points, "label", "pompes", fmt)).toBe("lun. 8, mar. 12");
  });

  it("ne compose aucun tiret cadratin quand il replie", () => {
    const neuf = Array.from({ length: 9 }, (_, i) => ({ label: `j${i}`, pompes: i }));
    const texte = decrireRepartition(neuf, "label", "pompes", fmt, "fr-FR") ?? "";
    expect(texte).not.toMatch(/—/);
    // Et il dit toujours ce qu'il doit dire : combien de barres, et l'étendue.
    expect(texte).toContain("9");
    expect(texte).toContain("0");
    expect(texte).toContain("8");
  });

  it("ne dit rien quand il n'y a rien", () => {
    expect(decrireRepartition([], "label", "pompes", fmt, "fr-FR")).toBeNull();
  });
});

describe("le résumé d'une évolution", () => {
  it("rend le compte de points et les deux bouts, déjà mis en forme", () => {
    const points = [{ cumul: 5 }, { cumul: 40 }, { cumul: 8905 }];
    const e = decrireEvolution(points, "cumul", (v) => `[${v}]`);
    expect(e).toEqual({ n: 3, debut: "[5]", fin: "[8905]" });
  });

  it("ne dit rien quand il n'y a rien", () => {
    expect(decrireEvolution([], "cumul", fmt)).toBeNull();
  });
});
