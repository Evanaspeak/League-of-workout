/**
 * Le plan d'action ne doit pas se mentir sur ses propres comptes.
 *
 * Chaque section porte un en-tête chiffré — « 4 à faire · 5 faits » — et ce
 * chiffre est écrit UNE fois, à la main, au-dessus d'un tableau qui bouge à
 * chaque nuit de travail. C'est la forme la plus discrète de la faute que ce
 * projet rencontre sans arrêt : un nombre posé un jour, juste ce jour-là, et
 * qui vieillit sans que rien ne le signale.
 *
 * Le prix est écrit dans CLAUDE.md : « un plan qu'on ne tient pas à jour ment,
 * et on lui obéit quand même ». Il a été payé — la section « Le social »
 * annonçait 6 à faire pour 7 faits quand la réalité était 2 pour 11, après une
 * nuit où ses lignes avaient été cochées une par une sans que l'en-tête suive.
 * Lu tel quel, il envoyait refaire du travail déjà fait.
 *
 * Ce garde ne juge pas ce qui est fait : il compare l'annonce au tableau qui
 * la suit, et c'est tout.
 */
import { readFileSync } from "fs";
import { join } from "path";

const PLAN = join(__dirname, "..", "docs/plan-action.md");

type Section = { titre: string; annonce: [number, number] | null; reste: number; faits: number };

function sections(): Section[] {
  const trouvees: Section[] = [];
  let courante: Section | null = null;
  for (const ligne of readFileSync(PLAN, "utf8").split("\n")) {
    const titre = /^#{2,3} (.+)/.exec(ligne);
    if (titre) {
      courante = { titre: titre[1].trim(), annonce: null, reste: 0, faits: 0 };
      trouvees.push(courante);
      continue;
    }
    if (!courante) continue;
    const chiffre = /^\*(\d+) à faires? · (\d+) faits?\.\*/.exec(ligne);
    if (chiffre) { courante.annonce = [Number(chiffre[1]), Number(chiffre[2])]; continue; }
    if (ligne.startsWith("| [x]")) courante.faits += 1;
    else if (ligne.startsWith("| [ ]")) courante.reste += 1;
  }
  return trouvees;
}

describe("les comptes du plan d'action", () => {
  /**
   * Le témoin. `toEqual([])` est vrai sur une liste vide : un fichier renommé,
   * un en-tête réécrit autrement, et le garde passerait au vert en ne comparant
   * rien. Dix sections chiffrées, alors qu'il y en a dix-sept — le chiffre dit
   * « on a lu quelque chose », pas « on a lu exactement ça ».
   */
  it("lit vraiment le plan", () => {
    const chiffrees = sections().filter((s) => s.annonce);
    expect(chiffrees.length).toBeGreaterThanOrEqual(10);
    // Et le tableau qui suit chaque en-tête n'est pas vide non plus, sinon on
    // comparerait des zéros à des zéros.
    expect(chiffrees.filter((s) => s.reste + s.faits === 0)).toEqual([]);
  });

  it("chaque en-tête chiffré dit ce que son tableau contient", () => {
    const ecarts = sections()
      .filter((s) => s.annonce)
      .filter((s) => s.annonce![0] !== s.reste || s.annonce![1] !== s.faits)
      .map((s) => `${s.titre} : annoncé ${s.annonce![0]}/${s.annonce![1]}, réel ${s.reste}/${s.faits}`);
    expect(ecarts).toEqual([]);
  });
});
