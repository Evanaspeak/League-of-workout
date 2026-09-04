import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ECARTS, MULTIPLICATEURS, PLANCHERS, depenseTotale, imc, masseGrasse,
  mesuresCompletes, metabolismeBase, objectifCalorique, type Mesures,
} from "@/lib/objectifCalorique";

const HOMME: Mesures = { formule: "h", poids: 80, taille: 180, age: 30, activite: "modere" };
const FEMME: Mesures = { formule: "f", poids: 60, taille: 165, age: 30, activite: "modere" };

describe("Mifflin-St Jeor", () => {
  it("rend les valeurs de la formule, pas des approximations", () => {
    // 10×80 + 6,25×180 − 5×30 + 5 = 800 + 1125 − 150 + 5
    expect(metabolismeBase(HOMME)).toBe(1780);
    // 10×60 + 6,25×165 − 5×30 − 161 = 600 + 1031,25 − 150 − 161
    expect(metabolismeBase(FEMME)).toBe(1320);
  });

  it("sépare bien les deux variantes de 166 kcal", () => {
    /**
     * L'écart exact entre les deux constantes, +5 et −161. C'est lui qui rend
     * le champ de formule nécessaire : retomber sur la mauvaise variante
     * fausse l'objectif d'une part qui se voit.
     */
    const meme = { ...HOMME, formule: "f" as const };
    expect(metabolismeBase(HOMME) - metabolismeBase(meme)).toBe(166);
  });

  it("applique le multiplicateur d'activité", () => {
    expect(depenseTotale({ ...HOMME, activite: "sedentaire" }))
      .toBe(Math.round(1780 * MULTIPLICATEURS.sedentaire));
    expect(depenseTotale({ ...HOMME, activite: "intense" }))
      .toBe(Math.round(1780 * MULTIPLICATEURS.intense));
  });
});

describe("les trois modes", () => {
  it("le maintien ne change rien", () => {
    const o = objectifCalorique(HOMME, "maintien");
    expect(o.cible).toBe(o.maintien);
  });

  it("la perte retire, la prise ajoute", () => {
    const maintien = depenseTotale(HOMME);
    expect(objectifCalorique(HOMME, "perte").cible).toBe(Math.round(maintien * 0.8));
    expect(objectifCalorique(HOMME, "prise").cible).toBe(Math.round(maintien * 1.1));
  });

  it("garde les trois modes, et pas un de plus", () => {
    // Réponse 019 : « les trois modes ». Un quatrième mode ajouté sans qu'on le
    // décide changerait ce que le produit promet.
    expect(Object.keys(ECARTS).sort()).toEqual(["maintien", "perte", "prise"]);
  });
});

describe("les deux avertissements, qui n'empêchent jamais d'afficher", () => {
  it("signale le plancher sans refuser le chiffre (réponse 017)", () => {
    /**
     * Une petite personne âgée et sédentaire en mode perte passe sous le
     * plancher. Le contrôle qui compte est le SECOND : la cible est rendue
     * quand même. Refuser d'afficher pousserait à chercher le chiffre
     * ailleurs, sans l'avertissement qui l'accompagne ici.
     */
    const o = objectifCalorique(
      { formule: "f", poids: 45, taille: 150, age: 65, activite: "sedentaire" },
      "perte",
    );
    expect(o.sousPlancher).toBe(true);
    expect(o.cible).toBeGreaterThan(0);
    expect(o.cible).toBeLessThan(PLANCHERS.f);
  });

  it("signale un IMC bas sans refuser le chiffre (réponse 018)", () => {
    const o = objectifCalorique({ ...HOMME, poids: 55 }, "perte");
    expect({ imcBas: o.imcBas, affiche: o.cible > 0 }).toEqual({ imcBas: true, affiche: true });
  });

  it("n'avertit pas quand il n'y a rien à signaler", () => {
    // Le témoin : sans lui, un drapeau toujours vrai passerait les deux
    // contrôles ci-dessus en ne prouvant rien.
    const o = objectifCalorique(HOMME, "maintien");
    expect({ sousPlancher: o.sousPlancher, imcBas: o.imcBas })
      .toEqual({ sousPlancher: false, imcBas: false });
  });
});

describe("ce que le module REFUSE de dire", () => {
  it("ne promet aucune date, aucune durée, aucun rythme (réponse 016)", () => {
    /**
     * La règle des 7 700 kcal par kilo est fausse : le corps ralentit sa
     * dépense à mesure qu'il maigrit. Une échéance calculée là-dessus dérape
     * de plusieurs semaines, et on la croit parce qu'elle est chiffrée.
     *
     * Le contrôle est STRUCTUREL et non de comportement : il n'y a pas de
     * fonction à appeler pour éprouver l'absence de quelque chose. Il lit donc
     * la source et refuse le vocabulaire de l'échéance — c'est la seule forme
     * qui attrape la fonction qu'on ajouterait demain.
     */
    const src = readFileSync(join(process.cwd(), "src", "lib", "objectifCalorique.ts"), "utf8");
    // Les commentaires EXPLIQUENT le refus : les lire ferait tomber le test
    // sur sa propre justification.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    expect(code.length).toBeGreaterThan(500); // témoin : on lit bien du code
    for (const mot of ["semaine", "7700", "7 700", "echeance", "échéance", "dateCible", "delai", "délai"]) {
      expect(code.toLowerCase()).not.toContain(mot.toLowerCase());
    }
  });
});

describe("les mesures qui manquent", () => {
  it("refuse un profil incomplet plutôt que de deviner", () => {
    /**
     * `calories.ts` a un poids par défaut de 70 kg, et c'est légitime là-bas :
     * il estime une dépense déjà faite, et une approximation vaut mieux que
     * rien. Ici on dit à quelqu'un combien MANGER — un chiffre calculé sur un
     * poids inventé serait faux et crédible.
     */
    expect(mesuresCompletes(null)).toBe(false);
    expect(mesuresCompletes({ ...HOMME, poids: 0 })).toBe(false);
    expect(mesuresCompletes({ ...HOMME, formule: undefined })).toBe(false);
    expect(mesuresCompletes({ ...HOMME, activite: "olympique" as never })).toBe(false);
    expect(mesuresCompletes(HOMME)).toBe(true);
  });

  it("rend un IMC nul plutôt que l'infini", () => {
    expect(imc(80, 0)).toBeNull();
    expect(imc(80, 180)).toBe(24.7);
  });
});

describe("la masse grasse au mètre-ruban", () => {
  it("estime les deux variantes", () => {
    expect(masseGrasse("h", 180, 85, 38)).toBeGreaterThan(15);
    expect(masseGrasse("h", 180, 85, 38)).toBeLessThan(30);
    expect(masseGrasse("f", 165, 75, 32, 95)).toBeGreaterThan(20);
    expect(masseGrasse("f", 165, 75, 32, 95)).toBeLessThan(45);
  });

  it("ne rend rien sans le tour de hanches pour la variante « f »", () => {
    // La formule ne l'a pas en option : sans lui, elle n'existe pas. La
    // réponse 024 l'a explicitement accepté pour cette raison.
    expect(masseGrasse("f", 165, 75, 32)).toBeNull();
    expect(masseGrasse("f", 165, 75, 32, 0)).toBeNull();
  });

  it("ne rend rien plutôt qu'un NaN quand le logarithme n'a pas de sens", () => {
    /**
     * Un tour de cou supérieur au tour de taille donne le logarithme d'un
     * nombre négatif. `NaN` traverse un affichage sans bruit — c'est le pire
     * résultat possible, parce qu'il ressemble à un chiffre absent alors qu'il
     * vient d'une saisie qu'on aurait dû signaler.
     */
    expect(masseGrasse("h", 180, 35, 40)).toBeNull();
    expect(masseGrasse("h", 0, 85, 38)).toBeNull();
  });

  it("écarte un pourcentage hors de tout domaine physiologique", () => {
    // Deux mesures presque égales font exploser le résultat : ce n'est pas une
    // mesure, c'est une frappe, et on ne la présente pas comme un résultat.
    expect(masseGrasse("h", 180, 38.5, 38)).toBeNull();
  });
});
