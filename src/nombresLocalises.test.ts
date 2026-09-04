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
/**
 * Ce gabarit est-il une LONGUEUR CSS plutôt qu'un pourcentage affiché ?
 *
 * Il vit hors de la boucle pour être ÉPROUVÉ. Sur les fichiers réels, une
 * dispense élargie à tout laisse le test au vert : il n'y a alors plus rien à
 * examiner, et rien ne distingue « aucun fautif » de « aucun regardé ». C'est
 * le défaut que ce fichier existe pour attraper ailleurs, et mon premier
 * sabotage l'a trouvé ici.
 *
 * Une longueur est la VALEUR d'une propriété de style : elle se reconnaît au
 * nom qui la précède, pas à une heuristique.
 */
export function estLongueurCss(debutLigne: string): boolean {
  return /(width|height|top|left|right|bottom|flexBasis|inset|translate|transform)\s*:\s*`?$/
    .test(debutLigne);
}

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

  /**
   * Le signe « % » recollé à la main n'a qu'une règle, donc cinq de fausses.
   *
   * Le français veut une espace insécable devant — « 33 % » — et l'anglais
   * n'en veut pas. Le winrate du tableau de bord affichait « 33% » dans les
   * six langues, alors que la correction avait DÉJÀ été faite pour le bilan de
   * saison : c'est la moitié non réparée, motif que ce projet paie en boucle.
   *
   * Ce qui n'est PAS visé : `width: ${p}%`, qui est une longueur CSS. Le
   * discriminant n'est pas une heuristique — une longueur est la valeur d'une
   * propriété de style, et elle se reconnaît au nom qui la précède.
   */
  it("ne recolle aucun % à la main dans un composant ou une page", () => {
    // Le discriminant, éprouvé sur des cas fabriqués : sans ça, l'élargir à
    // tout laisse le test au vert. Les fichiers réels ne le distinguent pas —
    // ils ne contiennent que des cas qu'il accepte.
    expect(estLongueurCss("              width: `")).toBe(true);
    expect(estLongueurCss("                width: ")).toBe(true);
    expect(estLongueurCss("          value={`")).toBe(false);
    expect(estLongueurCss("          {j.winrate === null ? t.sansObjet : `")).toBe(false);

    const fautifs: string[] = [];
    let trouves = 0;
    for (const f of tous) {
      const rel = relative(SRC, f).split("\\").join("/");
      if (rel === PORTE_LA_REGLE) continue;
      const texte = sansCommentaires(readFileSync(f, "utf8"));
      for (const m of texte.matchAll(/\$\{[^}]*\}\s?%/g)) {
        trouves += 1;
        const avant = texte.slice(0, m.index);
        const debutLigne = avant.slice(avant.lastIndexOf("\n") + 1);
        if (estLongueurCss(debutLigne)) continue;
        const ligne = avant.split("\n").length;
        fautifs.push(`${rel}:${ligne}`);
      }
    }

    // Et le motif doit trouver quelque chose : s'il ne voyait plus aucun
    // gabarit, il n'y aurait rien à trier.
    expect(trouves).toBeGreaterThan(3);
    expect(fautifs).toEqual([]);
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
