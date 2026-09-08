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

type Section = { titre: string; annonce: [number, number] | null; reste: number; faits: number; tranchees: number };

function sections(): Section[] {
  const trouvees: Section[] = [];
  let courante: Section | null = null;
  for (const ligne of readFileSync(PLAN, "utf8").split("\n")) {
    const titre = /^#{2,3} (.+)/.exec(ligne);
    if (titre) {
      courante = { titre: titre[1].trim(), annonce: null, reste: 0, faits: 0, tranchees: 0 };
      trouvees.push(courante);
      continue;
    }
    if (!courante) continue;
    const chiffre = /^\*(\d+) à faires? · (\d+) faits?\.\*/.exec(ligne);
    if (chiffre) { courante.annonce = [Number(chiffre[1]), Number(chiffre[2])]; continue; }
    if (ligne.startsWith("| [x]")) courante.faits += 1;
    else if (ligne.startsWith("| [ ]")) courante.reste += 1;
    else if (ligne.startsWith("| [-]")) courante.tranchees += 1;
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

  /**
   * L'en-tête GLOBAL, qui n'est suivi d'aucun tableau.
   *
   * Il a menti six jours — « 55 construits · 102 restants » pendant que les
   * dix-sept sections étaient tenues à jour ligne par ligne — parce que le
   * contrôle ci-dessous compare un en-tête au tableau qui le suit, et que
   * celui-là n'en a pas. C'est le défaut que ce plan reproche lui-même : un
   * plan qu'on ne tient pas à jour ment, et on lui obéit quand même.
   *
   * Il se compare donc à la SOMME des sections, qui est la seule chose dont il
   * puisse être la synthèse.
   */
  it("l'en-tête global dit la somme des sections", () => {
    const toutes = sections();
    const faits = toutes.reduce((n, s) => n + s.faits, 0);
    const reste = toutes.reduce((n, s) => n + s.reste, 0);
    // Le témoin : un plan vidé rendrait deux zéros, et « 0 construits · 0
    // restants » se comparerait très bien à lui-même.
    expect(faits + reste).toBeGreaterThan(100);
    const m = /\*\*(\d+) construits · (\d+) restants\*\*/.exec(readFileSync(PLAN, "utf8"));
    expect(m).not.toBeNull();
    expect({ faits: Number(m![1]), reste: Number(m![2]) }).toEqual({ faits, reste });
  });

  it("chaque en-tête chiffré dit ce que son tableau contient", () => {
    const ecarts = sections()
      .filter((s) => s.annonce)
      .filter((s) => s.annonce![0] !== s.reste || s.annonce![1] !== s.faits)
      .map((s) => `${s.titre} : annoncé ${s.annonce![0]}/${s.annonce![1]}, réel ${s.reste}/${s.faits}`);
    expect(ecarts).toEqual([]);
  });

  /**
   * Le troisième marqueur, et pourquoi il a besoin de son propre contrôle.
   *
   * `[-]` dit « tranché non » : le propriétaire a décidé que la ligne ne se
   * ferait pas, et elle reste au tableau pour qu'on ne la repropose pas. Elle
   * ne compte donc ni dans les faits ni dans le reste — ce qui est juste, et
   * ce qui la rend INVISIBLE aux deux contrôles ci-dessus.
   *
   * D'où le trou : une coche mal écrite — `[X]`, `[·]`, une espace de trop —
   * fait disparaître la ligne exactement de la même façon, sans que rien ne le
   * dise. Le seul moyen de distinguer une ligne volontairement hors compte
   * d'une ligne perdue est de fermer la liste des marqueurs permis.
   */
  it("aucune ligne de tableau ne porte un marqueur inconnu", () => {
    const permis = new Set(["x", " ", "~", "-"]);
    const inconnus: string[] = [];
    for (const ligne of readFileSync(PLAN, "utf8").split("\n")) {
      if (!ligne.startsWith("| [")) continue;
      const m = /^\| \[(.)\]/.exec(ligne);
      if (!m || !permis.has(m[1])) inconnus.push(ligne.slice(0, 60));
    }
    expect(inconnus).toEqual([]);
    // Le témoin : sans lui, un plan dont plus aucune ligne ne commence par
    // « | [ » rendrait une liste vide et passerait au vert.
    const lignes = readFileSync(PLAN, "utf8").split("\n").filter((l) => l.startsWith("| ["));
    expect(lignes.length).toBeGreaterThan(100);
  });

  /**
   * Et une ligne tranchée non doit DIRE qu'elle l'est. Sans raison écrite, un
   * `[-]` se lit comme un oubli de coche six semaines plus tard, et quelqu'un
   * la reprend.
   */
  it("une ligne tranchée non porte sa raison", () => {
    const muettes = readFileSync(PLAN, "utf8")
      .split("\n")
      .filter((l) => l.startsWith("| [-]"))
      .filter((l) => !/tranché/i.test(l))
      .map((l) => l.slice(0, 60));
    expect(muettes).toEqual([]);
  });
});
