/**
 * Une seule source d'alerte parmi les travaux programmés.
 *
 * Trois travaux tournent à l'heure ou au quart d'heure. S'ils échouent tous
 * quand le site va mal, une panne d'une nuit produit trois séries de courriels
 * qui disent la même chose. Le jour où l'un d'eux reste rouge, la boîte de
 * réception devient inutilisable : c'est arrivé, cinquante courriels en une
 * nuit, et la vraie conséquence n'est pas l'agacement mais le filtre qu'on
 * finit par poser dessus.
 *
 * La supervision alerte. Les autres notent et passent. Ce test refuse qu'un
 * travail programmé se remette à crier sans qu'on l'ait décidé.
 */
import fs from "node:fs";
import path from "node:path";

const DOSSIER = path.join(process.cwd(), ".github", "workflows");

/** Le travail dont c'est le métier d'alerter. */
const ALERTEUR = "supervision.yml";

/**
 * Les autres qui ont le droit de crier, et pourquoi.
 *
 * Le critère n'est pas la gravité, c'est la CADENCE : ce qui tourne toutes les
 * heures ne peut pas se permettre d'échouer, ce qui tourne une fois par jour
 * si. Un courriel quotidien se lit ; vingt-quatre ne se lisent pas.
 */
const EXCEPTIONS: Record<string, string> = {
  "sauvegarde.yml":
    "une fois par jour, donc un courriel par jour au plus, et une sauvegarde"
    + " qui échoue doit se voir",
};

/** Un travail se déclenche-t-il tout seul, à intervalle régulier ? */
export function estProgramme(texte: string): boolean {
  return /^\s{2}schedule:/m.test(texte);
}

/**
 * Le travail peut-il faire échouer son exécution, donc envoyer un courriel ?
 *
 * On cherche les deux façons de le faire dans un `run:` : l'annotation
 * d'erreur de GitHub, et une sortie non nulle explicite.
 */
export function peutCrier(texte: string): boolean {
  return /::error::/.test(texte) || /\bexit 1\b/.test(texte);
}

describe("une seule source d'alerte", () => {
  const fichiers = fs.readdirSync(DOSSIER).filter((f) => f.endsWith(".yml"));

  it("trouve bien les travaux programmés", () => {
    // Sans ce contrôle, un motif qui cesserait de correspondre rendrait une
    // liste vide, et le test suivant passerait en ne regardant rien.
    const programmes = fichiers.filter((f) =>
      estProgramme(fs.readFileSync(path.join(DOSSIER, f), "utf8")));
    expect(programmes).toContain(ALERTEUR);
    expect(programmes.length).toBeGreaterThan(1);
  });

  it("seule la supervision fait échouer son exécution", () => {
    const bavards = fichiers.filter((f) => {
      if (f === ALERTEUR || f in EXCEPTIONS) return false;
      const texte = fs.readFileSync(path.join(DOSSIER, f), "utf8");
      return estProgramme(texte) && peutCrier(texte);
    });
    expect(bavards).toEqual([]);
  });

  it("chaque exception dit pourquoi", () => {
    // Une exception sans raison écrite est une exception qu'on rouvrira sans
    // se souvenir de ce qu'elle protégeait.
    for (const [fichier, raison] of Object.entries(EXCEPTIONS)) {
      expect(fichiers).toContain(fichier);
      expect(raison.length).toBeGreaterThan(20);
    }
  });

  it("les deux détections savent répondre oui", () => {
    // Le sabotage : sans lui, deux fonctions qui rendraient toujours `false`
    // laisseraient le test précédent au vert pour toujours.
    const faux = 'on:\n  schedule:\n    - cron: "0 * * * *"\njobs:\n  x:\n    steps:\n'
      + '      - run: echo "::error::rien ne va"; exit 1\n';
    expect(estProgramme(faux)).toBe(true);
    expect(peutCrier(faux)).toBe(true);
  });
});
