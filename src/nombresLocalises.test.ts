import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Un nombre montré à quelqu'un passe par `Intl`, jamais par `toFixed`.
 *
 * `toFixed` rend TOUJOURS un point décimal. En allemand, le point est le
 * séparateur des MILLIERS : « 3.25 » s'y lit comme trois mille deux cent
 * cinquante. En français et en espagnol la virgule est attendue. Le KDA du
 * tableau de bord s'affichait ainsi dans les six langues.
 *
 * La règle du projet le disait déjà — « les dates et les nombres passent par
 * `Intl`, jamais de table écrite à la main » — et rien ne la tenait.
 *
 * Le contrôle porte sur la couche d'AFFICHAGE, c'est-à-dire les `.tsx`. Un
 * `toFixed` de `src/lib` ou d'une route en `.ts` sert à arrondir un nombre qui
 * repart en nombre (`Number(x.toFixed(1))`) : là, le point ne sort jamais à
 * l'écran, et l'interdire n'aurait aucun sens.
 *
 * Ce qui n'est PAS exigé, et sa raison : que tout le monde emploie `useNombre`.
 * Les images de saison et de séance sont rendues au SERVEUR par `next/og`, et
 * la page de profil public est un composant serveur — aucun des trois ne peut
 * appeler un crochet React. Tous passent la langue à `Intl`, ce qui est la
 * seule chose qui compte.
 */

const SRC = join(process.cwd(), "src");

/** Le fichier qui PORTE la règle : il la cite pour l'expliquer. */
const PORTE_LA_REGLE = "lib/i18n/LocaleContext.tsx";

function fichiersAffichage(dossier: string, out: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const c = join(dossier, e.name);
    if (e.isDirectory()) fichiersAffichage(c, out);
    else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) out.push(c);
  }
  return out;
}

/** Le texte sans ses commentaires : la règle s'y cite, elle ne s'y viole pas. */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .map((l) => l.replace(/\s\/\/.*$/, ""))
    .join("\n");
}

describe("les nombres montrés passent par Intl", () => {
  const tous = fichiersAffichage(SRC);

  it("regarde vraiment la couche d'affichage", () => {
    // Sans témoin, un dossier renommé rendrait le contrôle vert sur zéro
    // fichier lu, ce qui est la forme d'erreur que ce fichier existe pour
    // empêcher ailleurs.
    expect(tous.length).toBeGreaterThan(60);

    // Et la règle ne vaut que si le crochet commun existe : sans lui, il n'y a
    // rien à employer à la place, et l'interdiction serait un mur.
    const contexte = readFileSync(join(SRC, PORTE_LA_REGLE), "utf8");
    expect(contexte).toContain("export function useNombre(");
  });

  it("n'emploie aucun toFixed dans un composant ou une page", () => {
    const fautifs: string[] = [];
    for (const f of tous) {
      const rel = relative(SRC, f).split("\\").join("/");
      if (rel === PORTE_LA_REGLE) continue;
      const texte = sansCommentaires(readFileSync(f, "utf8"));
      for (const m of texte.matchAll(/\.toFixed\s*\(/g)) {
        const ligne = texte.slice(0, m.index).split("\n").length;
        fautifs.push(`${rel}:${ligne}`);
      }
    }
    expect(fautifs).toEqual([]);
  });
});
