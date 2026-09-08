/**
 * Ce qu'une route appelée par un travail programmé n'a pas le droit de faire.
 *
 * Le rappel du matin, la relance et le bilan cherchaient l'heure EXACTE. C'est
 * juste si le déclencheur passe toutes les heures — et il ne le fait pas :
 * relevé sur huit jours, trois à six passages par jour au lieu de vingt-quatre,
 * et aucun à l'heure voulue. Les trois envois ne sont jamais partis, en
 * répondant 200 à chaque passage.
 *
 * Le défaut n'est pas dans une ligne, il est dans une HYPOTHÈSE : « le
 * déclencheur est ponctuel ». Ce garde la refuse là où elle coûte cher — dans
 * les routes que les travaux programmés appellent, et nulle part ailleurs :
 * comparer une heure exacte est parfaitement légitime dans un écran.
 *
 * La liste des routes n'est pas tenue à la main : elle se lit dans les
 * workflows ET dans `vercel.json`, qui sont les deux sources de vérité. Une
 * route programmée ajoutée demain entre dans le champ toute seule.
 *
 * **Et elle suit UN saut d'aiguillage.** Vercel appelle un chemin en GET ; les
 * deux routes d'envoi sont en POST et le restent. Entre les deux vit
 * `/api/cron/matin`, qui ne compare aucune heure — donc qui satisferait ce
 * garde en ne prouvant rien pendant que les vraies routes lui échapperaient.
 * Ce n'est pas un trou théorique : le travail GitHub disparaîtra le jour où le
 * plan Vercel permettra un cron horaire, et c'est ce jour-là que les deux
 * routes sortiraient du champ sans que rien ne le dise. Un saut, pas
 * davantage : au-delà le garde ne dirait plus rien de précis.
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const RACINE = join(__dirname, "..");
const WORKFLOWS = join(RACINE, ".github", "workflows");

/** Les chemins d'API appelés directement par un déclencheur programmé. */
function declenchees(): string[] {
  const chemins = new Set<string>();
  for (const f of readdirSync(WORKFLOWS)) {
    if (!f.endsWith(".yml") && !f.endsWith(".yaml")) continue;
    const source = readFileSync(join(WORKFLOWS, f), "utf8");
    // Un travail sans `schedule:` n'est pas concerné : c'est la répétition
    // automatique qui crée le problème, pas l'appel lui-même.
    if (!/^\s*schedule:/m.test(source)) continue;
    for (const m of source.matchAll(/\$SITE(\/api\/[\w/-]+)/g)) chemins.add(m[1]);
  }
  try {
    const vercel = JSON.parse(readFileSync(join(RACINE, "vercel.json"), "utf8"));
    for (const c of vercel.crons ?? []) if (c?.path) chemins.add(c.path);
  } catch {
    // Pas de vercel.json : le contrôle de non-vacuité plus bas dira si c'est
    // parce qu'il n'y en a jamais eu ou parce qu'on vient de le perdre.
  }
  return [...chemins];
}

/**
 * Ce qu'un aiguilleur appelle. Un fichier de route qui importe le gestionnaire
 * d'une AUTRE route la déclenche aussi sûrement qu'un cron.
 */
export function aiguillages(source: string): string[] {
  const vers: string[] = [];
  for (const m of source.matchAll(/from\s+"@\/app(\/api\/[\w/[\]-]+)\/route"/g)) {
    vers.push(m[1]);
  }
  return vers;
}

/** Les chemins d'API que les travaux programmés atteignent, aiguillage compris. */
function routesProgrammees(): string[] {
  const chemins = new Set(declenchees());
  for (const c of [...chemins]) {
    const source = fichierDeRoute(c);
    if (source) for (const suivant of aiguillages(source)) chemins.add(suivant);
  }
  return [...chemins];
}

/** Le fichier de route qui sert ce chemin, s'il existe. */
function fichierDeRoute(chemin: string): string | null {
  const p = join(RACINE, "src", "app", chemin, "route.ts");
  try { return readFileSync(p, "utf8"); } catch { return null; }
}

describe("les routes appelées par un travail programmé", () => {
  const routes = routesProgrammees();

  // Sans ce contrôle, un motif qui ne trouve plus rien — un workflow renommé,
  // une variable d'adresse changée — rendrait tout le fichier vert en
  // n'examinant aucune route. C'est la forme d'erreur que ce garde combat.
  it("se trouvent en lisant les workflows", () => {
    expect(routes.length).toBeGreaterThanOrEqual(2);
    for (const r of routes) expect(fichierDeRoute(r)).not.toBeNull();
  });

  /**
   * Le cœur. `heureLocale(...) === 9` ne se déclenche que si le travail passe
   * pile à cette heure-là. Il faut une fenêtre, et `dansLaFenetreDuMatin` la
   * porte — avec la marque qui va avec, sinon on envoie trois fois.
   */
  it("ne comparent pas l'heure locale à une valeur exacte", () => {
    const fautives: string[] = [];
    for (const r of routes) {
      const source = fichierDeRoute(r) ?? "";
      // On lit le code, pas les commentaires : ceux-ci CITENT le motif fautif
      // pour expliquer pourquoi il a disparu.
      const code = source
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      if (/heureLocale\([^)]*\)\s*[!=]==/.test(code)) fautives.push(r);
    }
    expect(fautives).toEqual([]);
  });

  /**
   * Et la fenêtre doit être assez large pour qu'un déclencheur qui passe
   * quatre fois par jour ait une chance de tomber dedans. Une heure, c'est
   * exactement le cas qu'on vient de corriger.
   */
  it("s'appuient sur une fenêtre de plusieurs heures", () => {
    const { DEBUT_MATIN, FIN_MATIN } = jest.requireActual("@/lib/fenetreEnvoi");
    expect(FIN_MATIN - DEBUT_MATIN).toBeGreaterThanOrEqual(3);
  });
});

/**
 * Un canal muet ne doit pas consommer les marques.
 *
 * Sans clés VAPID, `notifier` rend zéro sans rien tenter ; sans clé Resend,
 * `envoyerBilanHebdo` rend `false`. Les deux routes continuaient quand même :
 * elles parcouraient toute la base et posaient `rappelLe`, `relanceLe` et
 * `bilanLe` sur chaque compte, pour des envois qui ne partaient pas. Et elles
 * rendaient `{ examines: N, envoyes: 0 }`, c'est-à-dire exactement la réponse
 * d'une matinée normale où il n'y a personne à prévenir.
 *
 * Les marques sont CONSOMMÉES : la relance des absents ne se rejoue qu'au bout
 * de quatre-vingt-dix jours. Le seul message que le produit adresse à
 * quelqu'un qui a cessé de jouer était donc brûlé par un déploiement incapable
 * de l'envoyer, en silence et en répondant 200.
 *
 * La règle : une route programmée qui envoie doit demander à son canal s'il
 * peut envoyer, AVANT d'écrire quoi que ce soit.
 */
describe("le canal d'envoi", () => {
  /** Ce qui envoie, et la question qu'il faut lui poser d'abord. */
  const CANAUX = [
    { envoie: /\bnotifier\s*\(/, demande: /pushConfigure\s*\(\s*\)/ },
    { envoie: /\benvoyerBilanHebdo\s*\(/, demande: /courrielConfigure\s*\(\s*\)/ },
  ];

  it("est consulté avant que la route n'écrive quoi que ce soit", () => {
    let examinees = 0;
    for (const chemin of routesProgrammees()) {
      const source = fichierDeRoute(chemin);
      if (!source) continue;
      for (const canal of CANAUX) {
        if (!canal.envoie.test(source)) continue;
        examinees += 1;
        // Nommer la route dans l'assertion : « false n'est pas true » ne dit
        // pas laquelle des routes programmées est en cause.
        expect({ route: chemin, demandeSonCanal: canal.demande.test(source) })
          .toEqual({ route: chemin, demandeSonCanal: true });
        // La question doit précéder la première écriture, sinon elle ne
        // protège rien : un contrôle posé après la boucle constate les dégâts.
        const question = source.search(canal.demande);
        const ecriture = source.search(/prisma\.\w+\.(update|updateMany|create)\b/);
        if (ecriture !== -1) expect(question).toBeLessThan(ecriture);
      }
    }
    // Sans témoin, un renommage de `notifier` rendrait ce test vert en
    // n'examinant aucun canal.
    expect(examinees).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Les tâches planifiées de Vercel.
 *
 * Elles remplacent une loterie : mesuré sur cent exécutions et douze jours, le
 * `schedule` de GitHub passe 8,3 fois par jour et rate la fenêtre de 9 h à
 * midi **six jours sur douze**. Deux heures fixes valent mieux que huit heures
 * au hasard — à condition que ces deux heures-là tombent dans la fenêtre, ce
 * qui n'a rien d'évident : l'heure du cron est en UTC et la fenêtre est en
 * heure LOCALE, donc elle bouge de soixante minutes entre l'été et l'hiver.
 */
describe("les crons de vercel.json", () => {
  const vercel = JSON.parse(readFileSync(join(RACINE, "vercel.json"), "utf8"));
  const crons: { path: string; schedule: string }[] = vercel.crons ?? [];

  it("désignent des routes qui existent", () => {
    expect(crons.length).toBeGreaterThanOrEqual(1);
    for (const c of crons) expect(fichierDeRoute(c.path)).not.toBeNull();
  });

  /**
   * Le contrôle qui vaut la peine. Un cron à 6 h UTC est parfaitement valable
   * et n'enverrait JAMAIS rien en France : 8 h en été, 7 h en hiver, deux fois
   * hors de la fenêtre. Rien ne le dirait — la route répondrait 200 avec zéro
   * envoi, ce qui est exactement le symptôme que ce fichier existe pour
   * empêcher.
   *
   * Les deux décalages sont ceux de la France : UTC+2 de fin mars à fin
   * octobre, UTC+1 le reste de l'année. Un cron doit tomber dans la fenêtre
   * **aux deux**, sinon il cesse de servir à la moitié de l'année, et ça se
   * découvre six mois plus tard.
   */
  it("tombent dans la fenêtre du matin, été comme hiver", () => {
    const { DEBUT_MATIN, FIN_MATIN } = jest.requireActual("@/lib/fenetreEnvoi");
    const dehors: string[] = [];
    for (const c of crons) {
      const m = /^(\d+) (\d+) \* \* \*$/.exec(c.schedule);
      // Un cron qui n'est pas quotidien à heure fixe sort de ce raisonnement :
      // « 0 * * * * » couvre tous les fuseaux et n'a rien à prouver ici.
      if (!m) continue;
      const heureUtc = Number(m[2]);
      for (const decalage of [1, 2]) {
        const locale = (heureUtc + decalage) % 24;
        if (locale < DEBUT_MATIN || locale >= FIN_MATIN) {
          dehors.push(`${c.schedule} → ${locale} h à UTC+${decalage}`);
        }
      }
    }
    expect(dehors).toEqual([]);
    // Le témoin : sans cron quotidien à heure fixe, la boucle ne compare rien.
    expect(crons.filter((c) => /^\d+ \d+ \* \* \*$/.test(c.schedule)).length)
      .toBeGreaterThanOrEqual(1);
  });

  /**
   * Deux passages valent mieux qu'un, et c'est la raison d'être de
   * l'aiguilleur : le plan Hobby n'autorise que deux tâches. Une par envoi
   * donnerait une seule chance à chacun ; un aiguilleur en donne deux aux
   * deux.
   */
  it("donnent plus d'une chance à la même matinée", () => {
    const quotidiens = crons.filter((c) => /^\d+ \d+ \* \* \*$/.test(c.schedule));
    const horaires = crons.filter((c) => /^\d+ \*/.test(c.schedule));
    expect(quotidiens.length + horaires.length * 24).toBeGreaterThanOrEqual(2);
  });
});

/**
 * Le saut d'aiguillage, éprouvé sur des cas fabriqués.
 *
 * L'état sain du dépôt ne distingue pas un saut qui marche d'un saut cassé :
 * les deux routes d'envoi sont ENCORE appelées directement par le workflow
 * GitHub, donc elles resteraient dans le champ même si `aiguillages` rendait
 * toujours une liste vide. C'est précisément le jour où le workflow
 * disparaîtra que le trou s'ouvrirait, et ce jour-là aucun test ne serait
 * rouge. Il se prouve donc ici, pas sur les fichiers réels.
 */
describe("suivre un aiguillage", () => {
  it("reconnaît un gestionnaire importé depuis une autre route", () => {
    const source = `
      import { POST as a } from "@/app/api/push/programme/route";
      import { POST as b } from "@/app/api/mail/hebdo/route";
      import { prisma } from "@/lib/prisma";
      import { POST as c } from "@/app/api/games/[id]/route";
    `;
    expect(aiguillages(source).sort()).toEqual([
      "/api/games/[id]",
      "/api/mail/hebdo",
      "/api/push/programme",
    ]);
  });

  it("ne prend pas un import ordinaire pour un aiguillage", () => {
    const source = `
      import { prisma } from "@/lib/prisma";
      import { secretProgrammeValide } from "@/lib/secretProgramme";
      import { NextResponse } from "next/server";
    `;
    expect(aiguillages(source)).toEqual([]);
  });

  it("atteint les deux routes d'envoi depuis l'aiguilleur réel", () => {
    const source = fichierDeRoute("/api/cron/matin");
    expect(source).not.toBeNull();
    expect(aiguillages(source!).sort()).toEqual(["/api/mail/hebdo", "/api/push/programme"]);
  });
});
