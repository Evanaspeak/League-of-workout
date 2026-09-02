/**
 * Le pont de la pastille en jeu.
 *
 * Vingt-quatre lignes, trois abonnements, et c'est le seul chemin par lequel
 * la pastille apprend quoi que ce soit. Deux choses peuvent mal tourner sans
 * qu'on le voie depuis l'application :
 *
 * - **les canaux se croisent.** Les trois messages ne se ressemblent pas — un
 *   état, des mots, un booléen de placement — mais ils passent par le même
 *   mécanisme. Un canal recopié d'un abonnement à l'autre enverrait l'état à
 *   celui qui attend des mots, et la pastille afficherait « undefined » par
 *   dessus le jeu ;
 * - **le désabonnement ne retire rien.** La pastille est créée et détruite au
 *   fil des parties : des écouteurs qui s'empilent finissent par peindre
 *   plusieurs fois par message.
 *
 * `electron` est doublé ; rien ici ne demande de fenêtre.
 */
// `export {}` fait de ce fichier un MODULE. Sans lui, TypeScript le traite
// comme un script : ses noms de premier niveau — `pont`, `emettre` — entrent
// dans la portée globale et entrent en collision avec ceux de
// `preload.test.ts`. Jest ne s'en aperçoit pas, chaque fichier ayant sa propre
// portée à l'exécution ; c'est `tsc` qui le dit, et il a raison.
export {};

type Ecouteur = (evenement: unknown, charge: unknown) => void;

const canaux = new Map<string, Ecouteur[]>();
const pont: Record<string, (f: (v: unknown) => void) => () => void> = {};

jest.mock("electron", () => ({
  contextBridge: {
    exposeInMainWorld: (_n: string, api: Record<string, unknown>) => { Object.assign(pont, api); },
  },
  ipcRenderer: {
    on: (c: string, f: Ecouteur) => { canaux.set(c, [...(canaux.get(c) ?? []), f]); },
    removeListener: (c: string, f: Ecouteur) => {
      canaux.set(c, (canaux.get(c) ?? []).filter((g) => g !== f));
    },
  },
}), { virtual: true });

require("./overlay-preload.js");

function emettre(canal: string, charge: unknown) {
  for (const f of [...(canaux.get(canal) ?? [])]) f(null, charge);
}

beforeEach(() => { for (const [c, l] of canaux) if (l.length) canaux.set(c, []); });

describe("les trois abonnements de la pastille", () => {
  const cas: [string, string][] = [
    ["onEtat", "overlay:etat"],
    ["onTextes", "overlay:textes"],
    ["onPlacement", "overlay:placement"],
  ];

  it.each(cas)("%s écoute son canal et rien d'autre", (methode) => {
    const vus: unknown[] = [];
    pont[methode]((v) => vus.push(v));
    for (const [, autre] of cas) emettre(autre, autre === "overlay:placement" ? true : autre);
    expect(vus).toHaveLength(1);
  });

  it.each(cas)("%s se désabonne pour de bon", (methode, canal) => {
    const vus: unknown[] = [];
    const retirer = pont[methode]((v) => vus.push(v));
    emettre(canal, true);
    expect(vus).toHaveLength(1);
    retirer();
    emettre(canal, true);
    expect(vus).toHaveLength(1);
  });

  it("transmet la charge telle quelle", () => {
    const vus: unknown[] = [];
    pont.onEtat((v) => vus.push(v));
    pont.onTextes((v) => vus.push(v));
    emettre("overlay:etat", { points: 42 });
    emettre("overlay:textes", { aFaire: "À faire" });
    expect(vus).toEqual([{ points: 42 }, { aFaire: "À faire" }]);
  });

  /**
   * Le placement arrive en booléen, et la pastille s'en sert pour décider si
   * elle se laisse attraper à la souris. Une valeur absente ne doit pas la
   * rendre attrapable par accident au milieu d'une partie.
   */
  it("réduit le placement à un booléen", () => {
    const vus: unknown[] = [];
    pont.onPlacement((v) => vus.push(v));
    emettre("overlay:placement", undefined);
    emettre("overlay:placement", true);
    expect(vus).toEqual([false, true]);
  });
});
