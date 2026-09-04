import { readFileSync } from "node:fs";
import { join } from "node:path";
import { JEUX } from "@/lib/jeux";

/**
 * La bande de l'accueil montre TOUS les jeux du catalogue.
 *
 * Elle portait sa propre liste, écrite à la main, et cette liste avait déjà
 * divergé : treize jeux contre quinze au catalogue, « Call of Duty » et « Les
 * Sims » absents. Le défaut ne se signalait par rien — une bande de treize
 * pastilles ressemble à une bande de quinze, et la page d'accueil est
 * précisément celle que personne ne relit ligne à ligne.
 *
 * Ce qu'on perd quand ça arrive n'est pas cosmétique : c'est la seule page qui
 * amène du monde, et elle promet « les jeux pris en charge ». Un jeu ajouté au
 * catalogue qui n'y figure pas est une fonctionnalité livrée que personne ne
 * saura qu'elle existe.
 *
 * La parure — abréviation, teinte, genre — ne peut pas se déduire du
 * catalogue, et n'a rien à y faire : celui-ci décide de ce qu'une partie
 * coûte, pas de ce à quoi elle ressemble. Ce test tient donc la seule chose
 * qui compte : que la table de parure couvre le catalogue.
 */

const SOURCE = join(process.cwd(), "src", "components", "landing", "BandeJeux.tsx");

/** Les noms de jeu qui portent une parure, lus dans la source. */
function decores(): string[] {
  const texte = readFileSync(SOURCE, "utf8");
  const bloc = texte.slice(
    texte.indexOf("const DECORS: Record<string, Decor> = {"),
    texte.indexOf("};", texte.indexOf("const DECORS: Record<string, Decor> = {")),
  );
  return [...bloc.matchAll(/^\s*"([^"]+)":\s*\{/gm)].map((m) => m[1]);
}

describe("la bande de jeux de l'accueil", () => {
  it("lit vraiment la table de parure", () => {
    /**
     * Le témoin. Sans lui, une table renommée rendrait le contrôle suivant
     * vert en comparant le catalogue à une liste vide — c'est-à-dire en
     * signalant que TOUT manque, ce qui `toEqual([])` ne dirait justement pas
     * dans l'autre sens.
     */
    expect(decores().length).toBeGreaterThanOrEqual(JEUX.length);
  });

  it("habille chaque jeu du catalogue", () => {
    const orphelins = JEUX.map((j) => j.nom).filter((n) => !decores().includes(n));
    expect(orphelins).toEqual([]);
  });

  it("n'habille pas un jeu qui n'existe plus au catalogue", () => {
    /**
     * L'autre sens, et il coûte moins cher mais compte quand même : une parure
     * qui ne désigne plus rien est du code mort qu'on finit par traduire, et
     * la bande la SAUTE en silence, donc rien ne le dirait.
     */
    const noms = new Set(JEUX.map((j) => j.nom));
    expect(decores().filter((n) => !noms.has(n))).toEqual([]);
  });

  it("donne un code de fichier distinct à chaque jeu", () => {
    /**
     * Deux jeux qui partagent un code partagent leur logo : déposer celui de
     * l'un remplacerait le glyphe de l'autre, et le symptôme — un mauvais logo
     * sur une pastille — ne ressemble pas à sa cause.
     */
    const texte = readFileSync(SOURCE, "utf8");
    const codes = [...texte.matchAll(/code:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(codes.length).toBe(JEUX.length);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
