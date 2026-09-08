import fs from "node:fs";
import path from "node:path";

/**
 * Une partie sans enjeu sort de tout ce qui agrège.
 *
 * Elle reste dans l'historique — on a joué, la trace reste — et elle ne doit
 * peser sur aucun chiffre : winrate, paliers, bilan de saison, maîtrise du
 * champion, détail horaire. Les tests par route le vérifient une par une, ce
 * qui est bon et ne dit rien de la route qu'on ajoutera demain.
 *
 * Le contrôle est un motif, donc grossier : il lit les trois cents caractères
 * qui suivent chaque lecture de `Game`. Ça suffit pour attraper le `where` de
 * l'appel lui-même, qui est le seul endroit où le filtre peut vivre.
 */

const RACINE = path.join(process.cwd(), "src", "app", "api");

/**
 * La dispense se déclare AU POINT D'APPEL, pas dans une liste ici.
 *
 * Elle vivait dans une table indexée par « route : opération », et cette
 * clé-là ne distingue pas deux appels de MÊME nature dans un MÊME fichier.
 * `games/route.ts` en porte désormais deux : le compte de maîtrise, qui doit
 * écarter les parties sans enjeu, et le total de l'historique, qui doit les
 * garder. Une dispense de route aurait couvert les deux — donc rendu le garde
 * muet le jour où le premier perdrait son filtre, c'est-à-dire exactement ce
 * qu'il existe pour dire.
 *
 * Le marqueur est un jeton qu'on n'écrit pas par accident, et la RAISON est à
 * côté de lui, là où elle se relit quand on touche à l'appel.
 */
const MARQUEUR = "SANS_ENJEU_GARDEES";

/**
 * `findFirst` n'y figure pas : lire UNE partie par son identifiant n'est
 * jamais une statistique. La correction d'un résultat et le contrôle « cette
 * partie Riot est-elle déjà enregistrée ? » doivent d'ailleurs pouvoir
 * atteindre une partie sans enjeu, sinon elle devient incorrigible et
 * ajoutable une seconde fois.
 */
const OPERATIONS = ["findMany", "aggregate", "count", "groupBy"].join("|");

function routes(): { nom: string; texte: string }[] {
  const trouvees: { nom: string; texte: string }[] = [];
  const parcourir = (dossier: string) => {
    for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
      const complet = path.join(dossier, e.name);
      if (e.isDirectory()) parcourir(complet);
      /**
       * `route.ts` ET `route.tsx`.
       *
       * Next accepte les deux, et trois routes de ce projet sont en `.tsx` —
       * les deux images rendues par `next/og` et l'icône PWA. Elles étaient
       * donc INVISIBLES à ce recensement depuis qu'elles existent : le garde
       * ne trouvait rien à leur reprocher parce qu'il ne les lisait pas.
       * Éprouvé en neutralisant le verrou de session de `seance/image`, qui
       * n'a fait tomber aucun test.
       */
      else if (e.name === "route.ts" || e.name === "route.tsx") {
        trouvees.push({
          nom: path.relative(RACINE, dossier).replace(/\\/g, "/"),
          texte: fs.readFileSync(complet, "utf8"),
        });
      }
    }
  };
  parcourir(RACINE);
  return trouvees;
}

const motif = () => new RegExp(`prisma\\.game\\.(${OPERATIONS})\\b`, "g");

describe("les parties sans enjeu ne comptent pas", () => {
  const toutes = routes();

  it("trouve bien les lectures de parties : sinon il ne contrôle rien", () => {
    const total = toutes.reduce((n, r) => n + [...r.texte.matchAll(motif())].length, 0);
    expect(total).toBeGreaterThan(9);
  });

  it("chaque agrégat de parties écarte celles sans enjeu, ou dit pourquoi il les garde", () => {
    const nus: string[] = [];
    for (const r of toutes) {
      for (const m of r.texte.matchAll(motif())) {
        const appel = `${r.nom} : game.${m[1]}`;
        /**
         * Six cents caractères, et non trois cents : le `where` du tableau de
         * bord vient APRÈS un commentaire qui explique pourquoi il est là.
         * Une fenêtre trop courte faisait tomber la route qui porte le filtre
         * le plus important des six.
         */
        const suite = r.texte.slice(m.index!, m.index! + 600);
        if (/sansEnjeu:\s*false/.test(suite)) continue;
        if (suite.includes(MARQUEUR)) continue;
        nus.push(appel);
      }
    }
    expect(nus).toEqual([]);
  });

  it("chaque marqueur est posé dans la fenêtre d'une lecture, et porte sa raison", () => {
    /*
      Deux façons pour ce contrôle de ne rien prouver, et il faut les deux :
      un marqueur qui ne désigne plus aucune lecture est du code mort dans le
      garde qui existe pour l'attraper ; un marqueur sans raison écrite est une
      exemption qu'on relit comme une garantie.
    */
    let poses = 0;
    for (const r of toutes) {
      const fenetres = [...r.texte.matchAll(motif())]
        .map((m) => r.texte.slice(m.index!, m.index! + 600));
      for (const m of r.texte.matchAll(new RegExp(MARQUEUR, "g"))) {
        poses += 1;
        expect({ route: r.nom, dansUneFenetre: fenetres.some((f) => f.includes(MARQUEUR)) })
          .toEqual({ route: r.nom, dansUneFenetre: true });
        // La raison suit le marqueur, dans le même commentaire.
        const apresMarqueur = r.texte.slice(m.index! + MARQUEUR.length, m.index! + MARQUEUR.length + 400);
        const raison = apresMarqueur.split("*/")[0];
        expect({ route: r.nom, raisonEcrite: raison.replace(/[\s*]/g, "").length > 60 })
          .toEqual({ route: r.nom, raisonEcrite: true });
      }
    }
    expect(poses).toBeGreaterThan(4);
  });
});
