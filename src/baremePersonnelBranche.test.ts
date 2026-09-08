import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { argumentsDe } from "@/quantiteLocalisee.test";
import { sansCommentaires } from "@/test/sansCommentaires";

/**
 * Le barème PERSONNEL est branché partout où le serveur convertit.
 *
 * Réponse 047 : les ratios d'exercices peuvent être réglés par compte. Ils
 * s'installaient jusque-là sur un objet de MODULE (`appliquerRatios`), et le
 * commentaire de cette fonction écrivait pourquoi c'était sans risque — « les
 * ratios étant globaux, les mêmes pour tout le monde ». La réponse invalide la
 * prémisse : un objet de module est partagé par toutes les requêtes du
 * processus, donc y poser le barème d'un compte fait convertir la dette de
 * l'un avec les ratios de l'autre.
 *
 * Ce défaut-là ne casse rien et ne se voit pas : les deux nombres sont
 * plausibles, aucune erreur n'est levée, et il faut deux comptes actifs en
 * même temps pour le rencontrer. C'est exactement le genre que ce projet ne
 * découvre que sur la machine de quelqu'un d'autre.
 *
 * D'où la règle : **au SERVEUR, une conversion passe ses ratios
 * explicitement.** Le navigateur, lui, garde le module — il n'y a qu'une
 * personne devant un navigateur, et c'est ce qui rend le raccourci sûr là-bas.
 *
 * L'argument reste OPTIONNEL dans les signatures, et il devait l'être : son
 * absence emploie le barème GLOBAL, c'est-à-dire le comportement d'avant. Un
 * appelant qui l'oublie retombe donc sur le commun, jamais sur quelqu'un
 * d'autre — c'est cette propriété qui a permis de reprendre les appelants un
 * par un. Le prix est qu'un oubli ne casse RIEN, et c'est ce contrôle-ci, et
 * lui seul, qui rend l'argument obligatoire en pratique.
 */

const SRC = join(process.cwd(), "src");

/** Le serveur : c'est là que plusieurs comptes traversent le même processus. */
const COTE_SERVEUR = "app/api";

/**
 * Le RANG de l'argument qui porte les ratios, par fonction.
 *
 * Un rang et pas un nombre d'arguments : `ventiler(x, null, etiquette)` en
 * porte trois et ne passe aucun barème. C'est la forme qu'avaient toutes les
 * conversions de routes avant cette reprise, et un contrôle d'ARITÉ l'aurait
 * laissée passer.
 */
const RANG_DES_RATIOS: Record<string, number> = {
  quantite: 2,          // (points, exercice, ratios)
  formaterCompact: 2,   // (points, exercice, ratios, etiquette)
  ventiler: 1,          // (parExercice, ratios, etiquette)
  convertirDette: 2,    // (points, exercice, ratios)
  secondesParPoint: 1,  // (exercice, ratios)
  dureeEffort: 3,       // (points, exercices, parts, ratios)
  dureeAffichee: 3,     // (points, exercices, parts, ratios)
  caloriesDePoints: 4,  // (points, exercices, poidsKg, parts, ratios)
  reponseDette: 1,      // (user, ratios)
};

/** Ce qui ne porte AUCUN barème, quel qu'en soit le texte. */
const VIDE = new Set(["null", "undefined"]);

function fichiersSource(dossier: string, out: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "generated") continue;
    const c = join(dossier, e.name);
    if (e.isDirectory()) fichiersSource(c, out);
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) out.push(c);
  }
  return out;
}

describe("le barème personnel est branché au serveur", () => {
  const routes = fichiersSource(SRC)
    .filter((f) => relative(SRC, f).split("\\").join("/").startsWith(COTE_SERVEUR));

  it("passe les ratios à chaque conversion faite dans une route", () => {
    const fautifs: string[] = [];
    let examines = 0;

    for (const f of routes) {
      const rel = relative(SRC, f).split("\\").join("/");
      const texte = sansCommentaires(readFileSync(f, "utf8"));
      for (const [nom, rang] of Object.entries(RANG_DES_RATIOS)) {
        for (const m of texte.matchAll(new RegExp(`\\b${nom}\\s*\\(`, "g"))) {
          const args = argumentsDe(texte, m.index + m[0].length - 1);
          examines += 1;
          const passe = args?.[rang]?.trim();
          if (!passe || VIDE.has(passe)) {
            fautifs.push(`${rel} : ${nom}(${(args ?? []).join(", ")})`);
          }
        }
      }
    }

    expect(fautifs).toEqual([]);
    // Sans ce témoin, un dossier renommé rendrait le contrôle vert en
    // n'examinant aucun appel — la forme d'erreur que ce fichier existe pour
    // empêcher, commise dans le fichier lui-même.
    expect(examines).toBeGreaterThan(8);
  });

  /**
   * Le barème d'un compte ne s'INSTALLE jamais sur le module.
   *
   * C'est l'autre moitié, et c'est celle qui fait le dégât : passer les ratios
   * partout ne sert à rien si une route pose au passage ceux de son visiteur
   * sur l'objet partagé. `ratiosPourCompte` ne le fait pas ; ce contrôle refuse
   * qu'une route appelle `appliquerRatios` elle-même.
   */
  it("n'installe aucun barème de compte sur le module", () => {
    const fautifs = routes.filter((f) =>
      /\bappliquerRatios\s*\(/.test(sansCommentaires(readFileSync(f, "utf8"))));
    expect(fautifs.map((f) => relative(SRC, f))).toEqual([]);
    expect(routes.length).toBeGreaterThan(30);
  });
});
