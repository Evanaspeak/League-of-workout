import fs from "fs";
import path from "path";

/**
 * Une route d'API ne sait pas dans quelle langue on la lit.
 *
 * Le tableau de bord l'avait appris pour les jours et les mois : la route
 * envoie leur NUMÉRO, le navigateur les nomme avec `Intl`. Le commentaire qui
 * l'explique est posé dans `dashboard/route.ts` depuis ce jour-là — et deux
 * lignes plus bas, l'heure continuait de s'écrire `` `${h}h` ``, donc en
 * français dans les six langues, sur l'axe du graphique le plus vu du produit.
 *
 * Ce garde tient la règle pour la CLASSE : tout libellé qu'une route fabrique
 * doit être accompagné, dans le même objet, du nombre qui permet de le
 * renommer. Et le nombre ne suffit pas — il faut que la couche d'affichage
 * s'en SERVE pour composer le libellé, sinon on a envoyé de quoi corriger un
 * défaut sans le corriger, ce qui est le trou que ce projet paie en boucle.
 */

const RACINE = path.join(__dirname, "app", "api");
const AFFICHAGE = path.join(__dirname, "app", "[locale]", "dashboard", "TableauDeBord.tsx");

/** Les champs numériques qu'une route peut envoyer pour qu'on renomme son libellé. */
const RENOMMABLES = ["heure", "jour", "mois"];

/**
 * Le source privé de ses commentaires.
 *
 * Sans ça le garde lisait ce que j'avais écrit pour l'expliquer : le
 * commentaire posé au-dessus de l'heure dit « comme pour les jours et les
 * mois », et « mois » y suffisait à satisfaire le contrôle. Le sabotage
 * passait donc au vert sur le défaut remis à l'identique. C'est le pendant
 * exact du piège déjà écrit pour `envoisProgrammes.test.ts` — là, le
 * commentaire citait le motif fautif et déclenchait le garde ; ici, il le
 * calmait.
 *
 * Les chaînes et les gabarits sont préservés : ce qu'on y écrit part vraiment
 * dans la réponse, et le retirer ferait accuser un objet parfaitement juste.
 */
export function sansCommentaires(source: string): string {
  let out = "";
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    const suivant = source[i + 1];
    if (c === "/" && suivant === "/") {
      while (i < source.length && source[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && suivant === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const fin = c;
      out += c;
      i++;
      while (i < source.length && source[i] !== fin) {
        if (source[i] === "\\") { out += source[i]; i++; }
        if (i < source.length) { out += source[i]; i++; }
      }
      out += source[i] ?? "";
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Le littéral d'objet le plus intérieur qui entoure `index`.
 *
 * Un découpage sur les virgules ne marcherait pas : ces objets portent des
 * gabarits, des appels imbriqués et des accolades. On suit donc la PROFONDEUR,
 * comme le fait déjà le découpage d'arguments de `quantiteLocalisee.test.ts`.
 */
export function litteralAutour(source: string, index: number): string {
  const pile: number[] = [];
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === "{") pile.push(i);
    else if (c === "}") {
      const debut = pile.pop();
      if (debut !== undefined && debut <= index && i >= index) return source.slice(debut, i + 1);
    }
  }
  return "";
}

function fichiers(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...fichiers(p));
    else if (/\.tsx?$/.test(e.name) && !e.name.includes(".test.")) out.push(p);
  }
  return out;
}

/**
 * Les positions d'une clé `label`, forme complète ET raccourci d'objet.
 *
 * Le raccourci est la forme qui échappe : `monthLabels.map((label, i) => ({
 * label, … }))` n'écrit jamais `label:`. C'est le piège déjà payé sur
 * `filtreParCompte`, qui recalait `where: { id, userId }` pour la même raison.
 */
export function positionsLabel(source: string): number[] {
  const out: number[] = [];
  const motif = /(?<![A-Za-z0-9_$])label\s*[:,}\n]/g;
  let m: RegExpExecArray | null;
  while ((m = motif.exec(source))) out.push(m.index);
  return out;
}

describe("un libellé fabriqué par une route porte le nombre qui le renomme", () => {
  const routes = fichiers(RACINE);
  const trouves: { fichier: string; litteral: string }[] = [];
  for (const f of routes) {
    const src = sansCommentaires(fs.readFileSync(f, "utf8"));
    for (const i of positionsLabel(src)) {
      const lit = litteralAutour(src, i);
      // On ne regarde que ce qui part dans la réponse : un `label` déclaré
      // dans un type ou une variable locale n'est pas un objet servi.
      if (!/\b(avg|total|jour|mois|heure)\b/.test(lit)) continue;
      trouves.push({ fichier: path.relative(__dirname, f), litteral: lit });
    }
  }

  it("le recensement trouve les libellés du tableau de bord", () => {
    // Sans ce témoin, un dossier renommé ou un motif devenu aveugle rendrait
    // les contrôles verts en n'examinant aucun libellé.
    expect(trouves.length).toBeGreaterThanOrEqual(3);
  });

  it("il voit les DEUX formes, dont le raccourci d'objet", () => {
    // Le compte seul ne suffit pas : borné à `label:`, le recensement trouve
    // encore trois objets et reste au-dessus du témoin, en ayant perdu
    // exactement la forme la plus facile à manquer.
    expect(trouves.some((t) => /\blabel\s*:/.test(t.litteral))).toBe(true);
    expect(trouves.some((t) => /\blabel\s*,/.test(t.litteral))).toBe(true);
  });

  it("chacun porte un champ numérique renommable", () => {
    const fautifs = trouves
      .filter((t) => !RENOMMABLES.some((r) => new RegExp(`\\b${r}\\b`).test(t.litteral)))
      .map((t) => `${t.fichier} : ${t.litteral.replace(/\s+/g, " ").slice(0, 90)}`);
    expect(fautifs).toEqual([]);
  });

  it("la couche d'affichage compose le libellé à partir de chacun", () => {
    const vue = sansCommentaires(fs.readFileSync(AFFICHAGE, "utf8"));
    // Lire le champ ne suffit pas : `typeof p.heure === "number"` le lit sans
    // rien en faire, et le premier jet de ce contrôle s'en satisfaisait — le
    // sabotage qui retirait la mise en forme passait au vert. Ce qu'on exige
    // est que le champ NOURRISSE le libellé, c'est-à-dire qu'il entre dans
    // l'appel dont le résultat devient `label`.
    const employes = RENOMMABLES.filter((r) =>
      trouves.some((t) => new RegExp(`\\b${r}\\b`).test(t.litteral)),
    );
    expect(employes.length).toBeGreaterThanOrEqual(3);
    const absents = employes.filter(
      (r) => !new RegExp(`label:\\s*[\\w$.]+\\([^)]*\\.${r}\\b`).test(vue),
    );
    expect(absents).toEqual([]);
  });
});

describe("le retrait des commentaires", () => {
  const cas = [
    { src: "a; // mois\nb;", attendu: "a; \nb;" },
    { src: "a; /* jour */ b;", attendu: "a;  b;" },
    // Une adresse dans une chaîne porte deux barres obliques et n'est pas un
    // commentaire : la retirer ferait accuser un objet parfaitement juste.
    { src: 'x("https://a.b"); // t', attendu: 'x("https://a.b"); ' },
    { src: "x(`${h}h`); // heure", attendu: "x(`${h}h`); " },
  ];
  for (const c of cas) {
    it(`rend ${JSON.stringify(c.attendu)}`, () => {
      expect(sansCommentaires(c.src)).toBe(c.attendu);
    });
  }
});

describe("le découpage par profondeur", () => {
  // Les fichiers réels ne contiennent que des cas qu'il accepte : ils ne le
  // distinguent pas d'un découpage cassé. Il s'éprouve donc sur des cas
  // fabriqués, dont celui qu'une expression naïve raterait.
  const cas = [
    { src: "x({ label: 1, heure: 2 })", attendu: "{ label: 1, heure: 2 }" },
    { src: "x({ a: { b: 1 }, label: 2 })", attendu: "{ a: { b: 1 }, label: 2 }" },
    { src: "x({ label: `${h}h`, heure: h })", attendu: "{ label: `${h}h`, heure: h }" },
    { src: "y({ z: 1 }); w({ label: 3 })", attendu: "{ label: 3 }" },
  ];
  for (const c of cas) {
    it(`rend le bon objet pour ${JSON.stringify(c.src)}`, () => {
      expect(litteralAutour(c.src, c.src.indexOf("label"))).toBe(c.attendu);
    });
  }
});
