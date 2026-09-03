import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Aucune transaction Prisma. Le pilote de la production les refuse.
 *
 * La production parle à Neon par HTTP (`PrismaNeonHttp`), et son adaptateur
 * rejette explicitement : « Transactions are not supported in HTTP mode ».
 * La base locale, elle, passe par `PrismaPg` en TCP, où elles fonctionnent
 * parfaitement.
 *
 * Le prix de cet écart a été très cher. `PATCH /api/dette` — le paiement
 * d'une séance, c'est-à-dire la fonction principale du produit — ouvrait une
 * transaction interactive. Elle échouait à CHAQUE appel en ligne, la file
 * hors ligne se remplissait, et le seul symptôme visible était « six séances
 * faites hors réseau, en attente » sur une machine parfaitement connectée.
 * Pendant ce temps 1689 tests unitaires et 188 parcours navigateur passaient
 * au vert, tous contre une base TCP.
 *
 * C'est la forme la plus coûteuse de divergence entre les environnements :
 * celle que rien ne peut voir depuis la machine où l'on développe.
 *
 * Ce qu'il faut faire à la place : des écritures atomiques en elles-mêmes
 * (`increment`, `decrement`, `updateMany` conditionnel), un ordre choisi pour
 * que la panne à mi-chemin soit rattrapable, et un jeton d'unicité quand le
 * geste peut être rejoué.
 */
const SRC = join(__dirname);

function fichiers(dossier: string): string[] {
  const trouves: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const complet = join(dossier, entree);
    if (statSync(complet).isDirectory()) {
      // Le client engendré DÉCLARE `$transaction` : c'est sa signature, pas
      // un appel. On regarde le code écrit à la main.
      if (entree === "generated") continue;
      trouves.push(...fichiers(complet));
    } else if (/\.tsx?$/.test(entree) && !/\.test\.tsx?$/.test(entree)) {
      trouves.push(complet);
    }
  }
  return trouves;
}

describe("les transactions Prisma", () => {
  const tous = fichiers(SRC).map((f) => ({
    chemin: f.slice(SRC.length + 1),
    source: readFileSync(f, "utf8"),
  }));

  /**
   * Sans ce contrôle, un dossier renommé rendrait le test vert en n'examinant
   * aucun fichier — la forme d'erreur que `gardesNonVides` surveille.
   */
  it("examine vraiment des fichiers", () => {
    expect(tous.length).toBeGreaterThan(100);
    expect(tous.some((f) => /prisma\./.test(f.source))).toBe(true);
  });

  it("n'existent nulle part : la production les refuse", () => {
    const fautifs = tous
      .filter((f) => f.source.split("\n")
        .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .some((l) => l.includes("$transaction")))
      .map((f) => f.chemin);
    expect({ fautifs }).toEqual({ fautifs: [] });
  });
});
