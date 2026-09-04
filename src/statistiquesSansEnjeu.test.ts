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
 * Les lectures qui doivent GARDER les parties sans enjeu, chacune avec sa
 * raison. Une septième devrait faire se demander si le garde sert encore.
 */
const AVEC_SANS_ENJEU: Record<string, string> = {
  "games : game.findMany":
    "L'historique EST l'endroit où elles s'affichent : c'est tout l'objet de les enregistrer plutôt que de les jeter. Elles y portent leur annotation.",
  "games/dates : game.findMany":
    "La correction de date porte sur des parties choisies à la main dans l'historique : en écarter une la rendrait incorrigible.",
  "user/export : game.findMany":
    "Le droit à la portabilité couvre TOUT ce que l'application garde. En écarter une partie ferait un export incomplet, ce qui est le contraire de ce que l'article 20 demande.",
  "riot/match-history : game.findMany":
    "Cette lecture dit quelles parties Riot sont DÉJÀ enregistrées. Une partie sans enjeu l'est : l'écarter la ferait proposer à l'ajout une seconde fois.",
};

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
        if (appel in AVEC_SANS_ENJEU) continue;
        /**
         * Six cents caractères, et non trois cents : le `where` du tableau de
         * bord vient APRÈS un commentaire qui explique pourquoi il est là.
         * Une fenêtre trop courte faisait tomber la route qui porte le filtre
         * le plus important des six.
         */
        const suite = r.texte.slice(m.index!, m.index! + 600);
        if (/sansEnjeu:\s*false/.test(suite)) continue;
        nus.push(appel);
      }
    }
    expect(nus).toEqual([]);
  });

  it("chaque exemption désigne encore une lecture qui existe", () => {
    const vues = new Set<string>();
    for (const r of toutes) {
      for (const m of r.texte.matchAll(motif())) vues.add(`${r.nom} : game.${m[1]}`);
    }
    const mortes = Object.keys(AVEC_SANS_ENJEU).filter((a) => !vues.has(a));
    expect(mortes).toEqual([]);
  });

  it("chaque exemption porte sa raison écrite", () => {
    for (const [appel, raison] of Object.entries(AVEC_SANS_ENJEU)) {
      expect({ appel, longue: raison.length > 60 }).toEqual({ appel, longue: true });
    }
  });
});
