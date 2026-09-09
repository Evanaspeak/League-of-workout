import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Ce que l'application LIT dans son environnement, et ce que `.env.example`
 * annonce.
 *
 * Ce fichier existe pour une seule chose : dire à quelqu'un qui monte un
 * environnement ce qu'il lui faut. Il en annonçait NEUF quand l'application en
 * lisait dix-huit — et il parlait encore de Supabase, deux bases de données
 * plus tôt.
 *
 * **Chaque absence est silencieuse**, et deux d'entre elles ont déjà coûté une
 * entrée de journal chacune :
 *
 * - sans `RESEND_API_KEY`, le lien de récupération ne part pas. C'est la SEULE
 *   porte de secours du produit, et la route répond « c'est envoyé » de toute
 *   façon — la réponse doit rester générique, sinon elle permet d'énumérer les
 *   comptes ;
 * - sans les trois clés VAPID, `notifier()` rend zéro SANS RIEN TENTER : les
 *   marques d'envoi étaient posées quand même, et la relance des absents —
 *   une fois par trimestre — se brûlait pour rien.
 *
 * Aucune ne casse quoi que ce soit à la construction, et aucune ne se voit à
 * l'écran. C'est exactement ce que ce garde existe pour rendre visible.
 */
const RACINE = join(__dirname, "..");

/**
 * Ce qui se lit sans être une variable de DÉPLOIEMENT, chacun avec sa raison.
 *
 * Une exemption sans raison écrite finit par toutes les couvrir.
 */
const PAS_UN_REGLAGE: Record<string, string> = {
  NODE_ENV:
    "posée par l'outillage, jamais par une personne : Next la met à `production` à la construction et à `development` en développement",
  LOCALAPPDATA:
    "variable de Windows, lue par la coquille pour trouver le fichier de verrous du lanceur League — c'est le système qui la pose, pas nous",
};

function fichiers(dossier: string, prefixe = ""): { chemin: string; texte: string }[] {
  const lus: { chemin: string; texte: string }[] = [];
  for (const entree of readdirSync(dossier)) {
    const complet = join(dossier, entree);
    if (statSync(complet).isDirectory()) {
      if (entree === "generated" || entree === "node_modules") continue;
      lus.push(...fichiers(complet, `${prefixe}${entree}/`));
      // Les TESTS posent leurs propres variables : ils fabriquent un cas, ils
      // ne réclament pas un réglage.
    } else if (/\.(ts|tsx|js|mjs)$/.test(entree) && !/\.(test|spec)\.[jt]sx?$/.test(entree)) {
      lus.push({ chemin: relative(RACINE, complet), texte: readFileSync(complet, "utf8") });
    }
  }
  return lus;
}

/**
 * `scripts/` est hors du champ, et c'est écrit plutôt que tu.
 *
 * Ce sont des outils de MESURE : `BASE` et `BASE_RENDU` disent contre quel
 * serveur on mesure, pas comment le produit se déploie. Les annoncer dans le
 * fichier que quelqu'un copie pour monter un environnement l'enverrait
 * chercher un réglage qui n'existe pas.
 */
const SOURCES = [
  ...fichiers(join(RACINE, "src")),
  ...fichiers(join(RACINE, "desktop", "src")),
  { chemin: "middleware.ts", texte: readFileSync(join(RACINE, "middleware.ts"), "utf8") },
];

const LUES = new Map<string, string[]>();
for (const { chemin, texte } of SOURCES) {
  for (const t of texte.matchAll(/process\.env\.([A-Z_][A-Z0-9_]*)/g)) {
    LUES.set(t[1], [...(LUES.get(t[1]) ?? []), chemin]);
  }
}

const EXEMPLE = readFileSync(join(RACINE, ".env.example"), "utf8");
const DECLAREES = new Set(
  [...EXEMPLE.matchAll(/^([A-Z_][A-Z0-9_]*)=/gm)].map((t) => t[1]),
);

describe(".env.example", () => {
  it("recense vraiment quelque chose", () => {
    // Sans ce témoin, un dossier renommé ou un motif cassé rendrait les deux
    // ensembles vides et les contrôles verts en n'ayant rien regardé.
    expect(SOURCES.length).toBeGreaterThan(200);
    expect(LUES.size).toBeGreaterThan(8);
    expect(DECLAREES.size).toBeGreaterThan(12);
  });

  it("annonce tout ce que l'application lit", () => {
    const oubliees = [...LUES.keys()]
      .filter((v) => !(v in PAS_UN_REGLAGE) && !DECLAREES.has(v))
      .map((v) => `${v} — lue par ${LUES.get(v)!.join(", ")}`)
      .sort();
    expect({ oubliees }).toEqual({ oubliees: [] });
  });

  it("n'exempte que ce qui est encore lu", () => {
    const fantomes = Object.keys(PAS_UN_REGLAGE).filter((v) => !LUES.has(v));
    expect({ fantomes }).toEqual({ fantomes: [] });
  });

  it("ne parle plus d'une base qu'on n'emploie plus", () => {
    // Le fichier annonçait « Supabase Postgres » et deux adresses en
    // `pooler.supabase.com`, deux bases de données plus tôt. Une description
    // périmée ne se distingue pas d'une garantie : on la lit, on la croit, et
    // on monte l'environnement dessus.
    expect(EXEMPLE.toLowerCase()).not.toContain("supabase");
  });
});
