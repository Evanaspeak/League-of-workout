import fs from "fs";
import path from "path";

/**
 * Le plafond de cent est levé, et aucun texte ne doit encore le promettre.
 *
 * Il gardait la porte de la bêta ; V300 l'a retiré, `/waitlist` est partie
 * avec, et `betaRank` ne dit plus que l'ordre d'arrivée. La politique de
 * confidentialité, elle, a continué d'annoncer « Sélection des cent premiers
 * comptes » comme FINALITÉ de la candidature bêta — dans les six langues.
 *
 * Ce n'est pas une coquille de marketing : une finalité est ce que le
 * règlement exige d'exact, et celle-là décrivait une sélection qui n'existe
 * plus. Ce que la candidature sert vraiment aujourd'hui, c'est à décider de
 * l'accès — `porteBeta` ouvre sur `accepted`, `auth.ts` refuse sur
 * `rejected` — et à savoir d'où viennent les inscriptions.
 *
 * Le garde tient les DEUX moitiés ensemble : tant qu'aucun plafond ne vit
 * dans le code, aucun texte ne l'annonce. Le jour où l'on en remet un, ce
 * test tombe — et c'est le bon comportement : il oblige à reprendre le texte
 * en même temps que la règle.
 */

const SRC = __dirname;
const DICOS = path.join(SRC, "lib", "i18n", "dictionaries");

/** La forme qu'un plafond prendrait dans le code. */
const PLAFOND_DANS_LE_CODE = /BETA_LIMIT|PLAFOND_BETA|LIMITE_BETA/;

/** Ce qu'un texte dirait s'il annonçait encore le plafond. */
const PLAFOND_DANS_LE_TEXTE = [
  "cent premiers", "cent premières", "100 premiers", "100 premières",
  "first hundred", "first 100",
  "cien primeras", "cien primeros", "100 primeras",
  "ersten hundert", "ersten 100",
  "前一百", "前 100",
  "最初の百", "最初の100",
];

function tousLesFichiers(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...tousLesFichiers(p));
    else if (/\.tsx?$/.test(e.name) && !e.name.includes(".test.")) out.push(p);
  }
  return out;
}

describe("le plafond de cent est levé des deux côtés", () => {
  const dicos = fs.readdirSync(DICOS).filter((f) => f.endsWith(".ts") && !f.includes(".test."));

  it("le recensement lit les dictionnaires, et il y en a", () => {
    expect(dicos.length).toBeGreaterThanOrEqual(20);
  });

  it("aucun code ne réintroduit un plafond sans que le texte suive", () => {
    // Le contrôle est conditionnel : c'est ce qui en fait un garde des deux
    // moitiés plutôt qu'une interdiction. Un plafond remis SANS reprendre le
    // texte est le seul état refusé.
    const codeAvecPlafond = tousLesFichiers(path.join(SRC, "app"))
      .concat(tousLesFichiers(path.join(SRC, "lib")))
      .filter((f) => !f.includes("generated"))
      .filter((f) => PLAFOND_DANS_LE_CODE.test(fs.readFileSync(f, "utf8")));
    if (codeAvecPlafond.length > 0) return; // un plafond existe : le texte peut l'annoncer

    const fautifs: string[] = [];
    for (const f of dicos) {
      const texte = fs.readFileSync(path.join(DICOS, f), "utf8");
      for (const mot of PLAFOND_DANS_LE_TEXTE) {
        if (texte.includes(mot)) fautifs.push(f + " : « " + mot + " »");
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("le motif du texte reconnaît les six langues", () => {
    // Sans ce contrôle, une liste vidée rendrait le test vert en ne cherchant
    // rien. Les cas sont fabriqués : le dépôt sain n'en contient aucun.
    const cas = [
      "Sélection des cent premiers comptes",
      "Selection of the first hundred accounts",
      "Selección de las cien primeras cuentas",
      "Auswahl der ersten hundert Konten",
      "挑选前一百个账号",
      "最初の百アカウントの選定",
    ];
    for (const c of cas) {
      expect(PLAFOND_DANS_LE_TEXTE.some((m) => c.includes(m))).toBe(true);
    }
    // Et il ne crie pas sur ce qui va bien.
    expect(PLAFOND_DANS_LE_TEXTE.some((m) => "les paliers valent 100, 500".includes(m))).toBe(false);
  });
});
