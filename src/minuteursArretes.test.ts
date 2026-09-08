import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { corpsDesEffets } from "@/abonnementsRetires.test";
import { sansCommentaires } from "@/test/sansCommentaires";

/**
 * Un minuteur posé dans un effet s'arrête au démontage.
 *
 * C'est l'autre moitié du sujet ouvert par `abonnementsRetires` : celui-ci
 * tient les `addEventListener`, celui-là les `setInterval` et `setTimeout`.
 * Les deux se paient de la même façon — un effet qui repart en pose un
 * deuxième, et rien ne l'arrête — mais un INTERVALLE coûte bien plus cher
 * qu'un abonnement : il ne fait pas qu'attendre, il TRAVAILLE. Ce projet en a
 * trois qui sondent le réseau, et un sondage qui survit à son composant
 * continue d'appeler le serveur pour personne, indéfiniment.
 *
 * Le recensement à l'écriture est presque NÉGATIF : vingt-trois minuteurs
 * posés dans un effet, tous arrêtés. Ce garde est donc de non-régression, ce
 * qui est le bon moment pour l'écrire — la liste des cas légitimes est vide,
 * et il n'a aucune dispense à porter.
 *
 * **Sa portée s'arrête à l'EFFET, et c'est une limite qu'il vaut mieux écrire.**
 * Un minuteur posé dans un rappel — `startSession` en pose trois — a un autre
 * cycle de vie : le rappel peut se rejouer, et l'appariement mécanique
 * demanderait de connaître toute la machine à états du composant. C'est
 * exactement là qu'un garde fabrique des faux positifs. Les trois sondages de
 * `SessionContext` sont dans ce cas ; ils sont arrêtés par `stopSession` et
 * par un effet de démontage dédié, et c'est une relecture qui le tient, pas
 * ce fichier.
 *
 * **Le retrait n'est presque jamais écrit sur place**, et c'est ce qui rend le
 * contrôle moins simple qu'il n'y paraît : un effet rend souvent une fonction
 * NOMMÉE (`return arreterTick`) dont le corps vit ailleurs dans le fichier.
 * Chercher `clearInterval` dans le seul corps de l'effet ferait un faux
 * positif sur du code parfaitement juste — c'est arrivé au premier jet, sur
 * le décompte de la dette. On suit donc le nom rendu.
 */

const SRC = join(process.cwd(), "src");

function fichiersSource(dossier: string, out: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "generated") continue;
    const c = join(dossier, e.name);
    if (e.isDirectory()) fichiersSource(c, out);
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(c);
  }
  return out;
}

/** Le corps de la fonction de nettoyage rendue par un effet, s'il y en a une. */
export function nettoyageDe(effet: string, fichier: string): string {
  // `return () => …` : le nettoyage est écrit sur place.
  const surPlace = /return\s*\(\s*\)\s*=>/.exec(effet);
  if (surPlace) return effet.slice(surPlace.index);
  // `return arreterTick;` ou `return pont.onPhase(...)` : on suit le NOM, et
  // on lit sa déclaration dans le fichier.
  const parNom = /return\s+([A-Za-z_$][\w$]*)\s*;/.exec(effet);
  if (!parNom) return "";
  const nom = parNom[1];
  return corpsDeclare(nom, fichier);
}

/** Le texte qui suit la déclaration d'un nom, ou rien s'il n'en a pas. */
function corpsDeclare(nom: string, fichier: string): string {
  const decl = new RegExp(String.raw`(?:const|let|var|function)\s+${nom}\b[\s\S]{0,600}`).exec(fichier);
  return decl ? decl[0] : "";
}

/**
 * Le nettoyage, et ce qu'il APPELLE.
 *
 * Un nettoyage écrit sur place délègue souvent : `return () => { arreter(); }`.
 * S'arrêter au texte du nettoyage ferait un faux positif sur du code
 * parfaitement juste — c'est arrivé au premier jet, sur la visite guidée. On
 * suit UN saut, pas davantage : au-delà, le contrôle ne dirait plus rien de
 * précis, et c'est la borne déjà posée pour le garde du nom publié.
 */
export function nettoyageComplet(effet: string, fichier: string): string {
  const direct = nettoyageDe(effet, fichier);
  if (!direct) return "";
  const appeles = new Set<string>();
  for (const m of direct.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) appeles.add(m[1]);
  let total = direct;
  for (const nom of appeles) total += "\n" + corpsDeclare(nom, fichier);
  return total;
}

/**
 * La pose d'un minuteur, avec ce qui le RETIENT.
 *
 * Le nom à gauche du signe égal est la moitié qui compte : sans lui, personne
 * ne peut arrêter le minuteur, et un contrôle qui se contente de chercher
 * `clearInterval` quelque part dans le nettoyage laisse passer l'effet qui en
 * pose trois et n'en arrête que deux. C'est exactement la forme de
 * `SessionContext`, et le sabotage l'a dit — le premier jet passait au vert
 * en lui retirant un de ses trois arrêts.
 */
const POSE = /(?:(?:const|let|var)\s+)?([A-Za-z_$][\w$.]*)?\s*=?\s*\b(setInterval|setTimeout)\s*\(/g;
const ARRET = { setInterval: "clearInterval", setTimeout: "clearTimeout" } as const;

describe("les minuteurs posés dans un effet s'arrêtent", () => {
  const tous = fichiersSource(SRC);

  it("suit un nettoyage écrit sur place comme un nettoyage nommé", () => {
    // Éprouvé sur des cas FABRIQUÉS : l'état sain du dépôt est zéro
    // trouvaille, donc les fichiers réels ne distinguent pas un suivi juste
    // d'un suivi cassé.
    expect(nettoyageDe("x(); return () => clearInterval(t);", "")).toContain("clearInterval");
    expect(nettoyageDe("x(); return stop;", "const stop = () => clearInterval(t);"))
      .toContain("clearInterval");
    expect(nettoyageDe("x();", "const stop = () => clearInterval(t);")).toBe("");
    // Un nom qui ne désigne rien ne doit pas faire passer l'effet.
    expect(nettoyageDe("return inconnu;", "const autre = 1;")).toBe("");
    // Et le nettoyage qui DÉLÈGUE : un saut, pas davantage.
    expect(nettoyageComplet("return () => { arreter(); };", "const arreter = () => clearTimeout(t);"))
      .toContain("clearTimeout");
    expect(nettoyageComplet("return () => { rien(); };", "const rien = () => {};"))
      .not.toContain("clearTimeout");
  });

  it("chaque minuteur d'un effet est arrêté par son nettoyage", () => {
    const fautifs: string[] = [];
    let minuteurs = 0;
    let effetsVus = 0;
    const fichiersVus = new Set<string>();

    for (const f of tous) {
      const source = sansCommentaires(readFileSync(f, "utf8"));
      const effets = corpsDesEffets(source);
      effetsVus += effets.length;
      for (const effet of effets) {
        const nettoyage = nettoyageComplet(effet, source);
        for (const m of effet.matchAll(POSE)) {
          /**
           * Un minuteur posé dans un exécuteur de promesse est un DÉLAI, pas
           * une action différée : `new Promise((r) => setTimeout(r, 1500))`
           * est la façon d'écrire une attente, et il n'y a rien à annuler —
           * la promesse perdante d'une course est simplement ignorée. C'est
           * une exclusion de FORME et non une dispense nommée : une liste
           * d'exemptions aurait vieilli, la forme non.
           */
          const avant = effet.slice(Math.max(0, m.index - 40), m.index);
          if (/new Promise\s*\(/.test(avant)) continue;

          const tenu = m[1];
          const pose = m[2] as keyof typeof ARRET;
          const rel = relative(SRC, f).split("\\").join("/");
          minuteurs += 1;
          if (!tenu) {
            fichiersVus.add(f);
            fautifs.push(`${rel} : ${pose} posé sans être retenu`);
          } else if (!nettoyage.includes(`${ARRET[pose]}(${tenu}`)) {
            fichiersVus.add(f);
            fautifs.push(`${rel} : ${pose} retenu par ${tenu}, sans ${ARRET[pose]}(${tenu})`);
          }
        }
      }
    }

    expect(fautifs).toEqual([]);
    // Deux témoins, et il faut les deux : sans le premier, un dossier renommé
    // rendrait le contrôle vert en n'ouvrant aucun fichier ; sans le second,
    // un découpage d'effets qui ne trouve plus rien ferait la même chose.
    expect(effetsVus).toBeGreaterThanOrEqual(80);
    expect(minuteurs).toBeGreaterThanOrEqual(15);
  });
});
