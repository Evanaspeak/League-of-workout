import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Les trois outils de mesure regardent-ils la même surface ?
 *
 * `accessibilite.mjs`, `coutures.mjs` et `comparer-rendu.mjs` portent chacun
 * leur liste de pages, écrite à la main. Rien ne les reliait, et elles ont
 * divergé — trois fois, toutes trouvées en comparant deux outils plutôt qu'en
 * lisant l'un d'eux :
 *
 * - le balayage n'ouvrait pas les rubriques repliées des réglages, donc la
 *   moitié de cet écran n'était recensée par personne. C'est là qu'a été
 *   trouvée la couture de la date de consentement ;
 * - il ne visitait par défaut aucune page PUBLIQUE, alors que c'est sur
 *   celles-là qu'a été trouvée la date des documents juridiques servie en
 *   français aux six langues ;
 * - l'audit d'accessibilité n'ouvre ni `/amis` ni les rubriques de réglages,
 *   c'est-à-dire qu'aucun champ de formulaire des réglages n'est audité.
 *
 * Le symptôme est toujours le même, et c'est le pire d'un outil de mesure :
 * il ne dit pas « je n'ai pas regardé », il dit « rien à signaler ».
 *
 * Ce test ne demande pas que les trois listes soient IDENTIQUES — elles ne
 * mesurent pas la même chose, et une page peut légitimement n'intéresser
 * qu'un outil. Il demande que chaque écart soit DÉCLARÉ avec sa raison, ce
 * qui est la seule forme qui ne vieillit pas en silence.
 */

const RACINE = process.cwd();
const OUTILS = {
  accessibilite: [
    [/const PAGES = \[([\s\S]*?)\];/, "scripts/accessibilite.mjs"],
    [/const PAGES_CONNECTEES = \[([\s\S]*?)\];/, "scripts/accessibilite.mjs"],
  ],
  coutures: [[/const PAR_DEFAUT = \[([\s\S]*?)\]/, "scripts/coutures.mjs"]],
  rendu: [[/const PAGES = \[([\s\S]*?)\]/, "scripts/comparer-rendu.mjs"]],
} as const;

type Outil = keyof typeof OUTILS;

/**
 * Ce qu'un outil ne regarde pas, et pourquoi.
 *
 * Une dispense qui ne désigne plus rien tombe : c'est du code mort dans le
 * garde qui existe pour l'attraper.
 */
const DISPENSES: Record<Outil, Record<string, string>> = {
  accessibilite: {},
  coutures: {
    "/settings": "le balayage ouvre les CINQ rubriques, ce qui couvre strictement plus que la liste nue",
    "/recuperation/valider":
      "sans jeton la page ne rend qu'un état d'erreur : aucune valeur interpolée, donc rien à coudre",
  },
  rendu: {
    "/amis": "à ajouter — mesuré, non fait : chaque page coûte trois captures de chaque côté",
    "/bilan": "à ajouter — même raison",
    "/confidentialite": "à ajouter — même raison",
    "/calculateur": "à ajouter — même raison",
    "/calculateur/league-of-legends": "à ajouter — même raison",
    "/connexion-app": "ouverte par l'application avec un aléa ; sans lui elle rend un autre écran",
    "/recuperation": "un formulaire d'un champ, sans mise en page à faire régresser",
    "/recuperation/valider": "même raison, et elle demande un jeton",
  },
};

function pages(outil: Outil): Set<string> {
  const vues = new Set<string>();
  for (const [motif, fichier] of OUTILS[outil]) {
    const source = readFileSync(join(RACINE, fichier), "utf8");
    const bloc = motif.exec(source)?.[1] ?? "";
    for (const m of bloc.matchAll(/"(\/[^"]*)"/g)) vues.add(m[1]);
  }
  return vues;
}

describe("la couverture des outils de mesure", () => {
  it("se lit vraiment dans les trois", () => {
    // Le témoin : trois listes vides se couvrent parfaitement, donc un motif
    // devenu aveugle rendrait le contrôle vert en ne comparant rien.
    expect(pages("accessibilite").size).toBeGreaterThanOrEqual(14);
    expect(pages("coutures").size).toBeGreaterThanOrEqual(14);
    expect(pages("rendu").size).toBeGreaterThanOrEqual(10);
  });

  it("ne laisse aucun écart non déclaré", () => {
    const union = new Set([...pages("accessibilite"), ...pages("coutures"), ...pages("rendu")]);
    const manques: string[] = [];
    for (const outil of Object.keys(OUTILS) as Outil[]) {
      const vues = pages(outil);
      for (const page of union) {
        if (vues.has(page)) continue;
        if (DISPENSES[outil][page]) continue;
        manques.push(`${outil} ne regarde pas ${page}`);
      }
    }
    expect(manques.sort()).toEqual([]);
  });

  it("ne garde pas une dispense qui ne désigne plus rien", () => {
    const union = new Set([...pages("accessibilite"), ...pages("coutures"), ...pages("rendu")]);
    const mortes: string[] = [];
    for (const outil of Object.keys(OUTILS) as Outil[]) {
      const vues = pages(outil);
      for (const [page, raison] of Object.entries(DISPENSES[outil])) {
        if (!raison.trim()) mortes.push(`${outil} : ${page} dispensée sans raison`);
        // Une dispense pour une page que l'outil regarde, ou qu'aucun outil ne
        // connaît, ne désigne plus rien.
        if (vues.has(page)) mortes.push(`${outil} regarde ${page} : la dispense est caduque`);
        if (!union.has(page)) mortes.push(`${outil} : ${page} n'est dans aucune liste`);
      }
    }
    expect(mortes.sort()).toEqual([]);
  });
});
