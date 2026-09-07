import fs from "node:fs";
import path from "node:path";
import { sansCommentaires } from "./test/sansCommentaires";

/**
 * La frontière `not-found` de la racine ne lit RIEN de la requête.
 *
 * Elle appartient à l'arbre de rendu de CHAQUE route de l'application : une
 * API dynamique posée là — `headers()`, `cookies()`, `connection()` — rend
 * dynamique tout le site, sans qu'aucun test, aucun écran ni aucune mesure ne
 * le signale. C'est arrivé, et pendant des semaines : la 404 lisait la langue
 * dans un en-tête posé par le middleware, et **144 pages ont cessé d'être
 * prérendues**, dont les 96 du calculateur, qui n'existent que pour être
 * trouvées par un moteur. Le journal, lui, a continué d'annoncer « 228 pages
 * statiques » — c'est ce qui rend ce défaut cher : rien ne le contredit.
 *
 * Le symptôme n'est pas une panne, c'est une facture. Une page prérendue est
 * servie par le réseau de diffusion ; la même page dynamique demande une
 * exécution de fonction à chaque visite, et le premier octet arrive plus
 * tard. Aucun écran ne change, aucun test ne tombe.
 *
 * La langue vient donc du PARAMÈTRE DE ROUTE, sur une vraie page
 * (`/{langue}/introuvable`), et le middleware y réécrit les adresses inconnues
 * avec le code 404. La frontière racine reste, en anglais, pour ce que le
 * middleware ne voit pas.
 */

const RACINE = process.cwd();
const NOT_FOUND = path.join(RACINE, "src", "app", "not-found.tsx");

/**
 * Ce qui est rendu au-dessus de TOUTES les pages d'une coquille.
 *
 * Une mise en page ou un gabarit partagé a exactement la même propriété que la
 * frontière 404 : ce qu'il lit, toutes ses pages le paient. Le recensement va
 * les chercher dans le dossier plutôt que de les nommer — c'est un fichier
 * ajouté demain qui coûterait le plus cher.
 */
function frontieresPartagees(dossier: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const complet = path.join(dossier, e.name);
    if (e.isDirectory()) {
      // Une mise en page de sous-dossier ne couvre que ses propres pages : son
      // coût est borné, et c'est une décision qui lui appartient.
      if (e.name.startsWith("[") || e.name.startsWith("(")) frontieresPartagees(complet, out);
    } else if (e.name === "layout.tsx" || e.name === "template.tsx") {
      out.push(complet);
    }
  }
  return out;
}

/** Ce qu'une frontière de racine ne peut pas se permettre de lire. */
const APIS_DYNAMIQUES = [
  { motif: /\bheaders\s*\(/, nom: "headers()" },
  { motif: /\bcookies\s*\(/, nom: "cookies()" },
  { motif: /\bconnection\s*\(/, nom: "connection()" },
  { motif: /\bdraftMode\s*\(/, nom: "draftMode()" },
  { motif: /from\s+["']next\/headers["']/, nom: "un import de next/headers" },
];

/**
 * En plus, pour une mise en page partagée : lire la session.
 *
 * `auth()` est légitime dans une PAGE — elle seule paie son rendu à la
 * demande, et l'accueil le fait sciemment pour adapter trois boutons. Dans une
 * mise en page, il rendrait dynamique tout ce qu'elle enveloppe.
 */
const LECTURE_SESSION = { motif: /\bauth\s*\(\s*\)/, nom: "auth()" };

describe("la 404 de la racine", () => {
  /**
   * Le source PRIVÉ de ses commentaires.
   *
   * Sans ce retrait, le garde lit l'explication écrite au-dessus du code et se
   * déclenche sur elle : le défaut remis à l'identique passerait au vert, et
   * ce fichier-ci, qui NOMME `headers()` pour dire pourquoi il l'interdit,
   * tomberait sur lui-même. C'est le piège déjà payé deux fois sur ce projet,
   * dans les deux sens.
   */
  const source = sansCommentaires(fs.readFileSync(NOT_FOUND, "utf8"));

  it("existe et rend quelque chose", () => {
    // Sans ce contrôle, un fichier supprimé ou vidé rendrait tous les autres
    // verts en n'ayant rien à examiner.
    expect(source.length).toBeGreaterThan(200);
    expect(source).toMatch(/export default function|export default async function/);
  });

  it("ne lit aucune API dynamique", () => {
    const trouves = APIS_DYNAMIQUES.filter(({ motif }) => motif.test(source)).map((a) => a.nom);
    expect({ trouves }).toEqual({ trouves: [] });
  });

  /**
   * L'autre moitié : la 404 localisée doit exister, sinon la frontière racine
   * redevient le seul chemin et la langue repart avec.
   */
  it("a sa page localisée, qui prend sa langue du paramètre de route", () => {
    const page = path.join(RACINE, "src", "app", "[locale]", "introuvable", "page.tsx");
    expect(fs.existsSync(page)).toBe(true);
    const texte = sansCommentaires(fs.readFileSync(page, "utf8"));
    expect(texte).toMatch(/params/);
    // Elle non plus ne lit pas la requête : ce serait le même défaut déplacé.
    const fautifs = APIS_DYNAMIQUES.filter(({ motif }) => motif.test(texte)).map((a) => a.nom);
    expect({ fautifs }).toEqual({ fautifs: [] });
  });

  it("aucune mise en page partagée ne lit la requête non plus", () => {
    const frontieres = frontieresPartagees(path.join(RACINE, "src", "app"));
    // Témoin : un dossier renommé rendrait le contrôle vert sur zéro fichier.
    expect(frontieres.length).toBeGreaterThanOrEqual(2);
    const fautifs: string[] = [];
    for (const f of frontieres) {
      const texte = sansCommentaires(fs.readFileSync(f, "utf8"));
      for (const { motif, nom } of [...APIS_DYNAMIQUES, LECTURE_SESSION]) {
        if (motif.test(texte)) fautifs.push(`${path.relative(RACINE, f)} : ${nom}`);
      }
    }
    expect({ fautifs }).toEqual({ fautifs: [] });
  });

  /**
   * Et le branchement, sans lequel la page localisée ne sert à rien : le
   * middleware doit y RÉÉCRIRE, avec le code 404. Une redirection changerait
   * l'adresse affichée, et un `next()` rendrait 200 sur une adresse morte —
   * c'est-à-dire une adresse qui ne sort jamais d'un index.
   */
  it("est branchée : le middleware y réécrit avec le code 404", () => {
    const mw = sansCommentaires(fs.readFileSync(path.join(RACINE, "middleware.ts"), "utf8"));
    expect(mw).toMatch(/CHEMIN_INTROUVABLE/);
    // La cible se construit à partir de la constante, et la réécriture porte
    // le code. Les deux ensemble : la constante seule ne dit pas où l'on va,
    // et un `rewrite` sans statut rend 200 sur une adresse morte.
    expect(mw).toMatch(/cible\.pathname\s*=\s*avecLocale\(\s*CHEMIN_INTROUVABLE/);
    expect(mw).toMatch(/NextResponse\.rewrite\(\s*cible\s*,\s*\{\s*status:\s*404/);
  });
});
