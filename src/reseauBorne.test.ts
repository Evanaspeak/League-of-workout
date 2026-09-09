import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sansCommentaires } from "./test/sansCommentaires";

/**
 * Aucune requête du navigateur ne part sans échéance.
 *
 * Le journal a corrigé deux fois ce qu'un écran doit faire d'un échec réseau :
 * le REFUS du serveur et l'ABSENCE de réseau. Les deux finissent dans un
 * `catch` ou dans une branche `res.ok`, donc les deux rendent la main.
 *
 * Le troisième cas ne rend jamais la main : le serveur accepte la connexion et
 * n'honore pas la requête. `fetch` attend alors le délai TCP du système, qui
 * se compte en minutes. Ni le `catch`, ni le `finally`, ni le retour en
 * arrière ne passent — l'écran reste sur son ellipse ou sur son squelette, et
 * il montre un réglage que le serveur n'a jamais reçu.
 *
 * Démontré au navigateur avant d'être corrigé (`e2e/panne-serveur.spec.ts`) :
 * la requête retenue, le bouton du test de force reste `[disabled]`.
 *
 * Ce garde regarde le DOSSIER et non une liste écrite à la main : les tests par
 * appel ne disent rien du `fetch` qu'on ajoutera demain, et c'est exactement
 * celui-là qui repartira sans borne.
 */

const SRC = join(__dirname);

/**
 * Ce qui n'est pas rendu au navigateur, avec sa raison.
 *
 * `src/app/api` est écarté par le balayage lui-même : une route tourne au
 * serveur, où l'échéance appartient à la plateforme et non à nous.
 */
const DISPENSES: Record<string, string> = {
  "lib/reseau.ts":
    "c'est l'enveloppe elle-même — elle DOIT appeler le fetch nu, sinon elle s'appellerait",
  "lib/release.ts":
    "rendu au SERVEUR, avec un next:{revalidate} de cinq minutes. Y poser un signal " +
    "changerait la mise en cache de Next, c'est-à-dire précisément la régénération dont " +
    "dépend le bouton de téléchargement — le remède casserait ce qu'il vient garder",
};

function fichiers(dossier: string, sortie: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) {
      if (e.name === "generated" || e.name === "node_modules" || e.name === "test") continue;
      // Les routes tournent au serveur : l'échéance y appartient à la plateforme.
      if (chemin.endsWith(join("app", "api"))) continue;
      fichiers(chemin, sortie);
    } else if (
      (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) &&
      !e.name.includes(".test.") &&
      !e.name.endsWith(".d.ts")
    ) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

/** Le `fetch` global, pas `res.fetch` ni `fetchBorne`. */
const NU = /(^|[^.\w$])fetch\s*\(/;

describe("les requêtes du navigateur", () => {
  const tous = fichiers(SRC);

  it("examine assez de fichiers, et en trouve assez qui demandent le réseau", () => {
    // Le témoin. Un dossier renommé ou un motif devenu aveugle rendrait le
    // reste vert en n'ouvrant rien, et c'est ainsi que meurt un garde
    // structurel.
    expect(tous.length).toBeGreaterThan(150);
    const bornes = tous.filter((f) => /\bfetchBorne\s*\(/.test(readFileSync(f, "utf8")));
    expect(bornes.length).toBeGreaterThan(40);
  });

  it("partent toutes par l'enveloppe qui porte l'échéance", () => {
    const fautifs: string[] = [];
    for (const f of tous) {
      const nom = f.slice(SRC.length + 1).split("\\").join("/");
      if (nom in DISPENSES) continue;
      // Le source PRIVÉ de ses commentaires : ceux-ci nomment `fetch` pour
      // expliquer la règle, et un garde qui se déclenche sur sa propre
      // explication envoie corriger ce qui va bien.
      if (NU.test(sansCommentaires(readFileSync(f, "utf8")))) fautifs.push(nom);
    }
    expect(fautifs).toEqual([]);
  });

  it("ne garde aucune dispense qui ne désigne plus rien", () => {
    // Une exemption qui a survécu à son objet est du code mort dans le garde
    // qui existe pour l'attraper.
    const morts = Object.keys(DISPENSES).filter((nom) => {
      try {
        return !NU.test(sansCommentaires(readFileSync(join(SRC, nom), "utf8")));
      } catch {
        return true;
      }
    });
    expect(morts).toEqual([]);
  });
});
