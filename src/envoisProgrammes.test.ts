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
 * workflows, qui sont la source de vérité. Une route programmée ajoutée demain
 * entre dans le champ toute seule.
 */
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const RACINE = join(__dirname, "..");
const WORKFLOWS = join(RACINE, ".github", "workflows");

/** Les chemins d'API que les travaux programmés appellent. */
function routesProgrammees(): string[] {
  const chemins = new Set<string>();
  for (const f of readdirSync(WORKFLOWS)) {
    if (!f.endsWith(".yml") && !f.endsWith(".yaml")) continue;
    const source = readFileSync(join(WORKFLOWS, f), "utf8");
    // Un travail sans `schedule:` n'est pas concerné : c'est la répétition
    // automatique qui crée le problème, pas l'appel lui-même.
    if (!/^\s*schedule:/m.test(source)) continue;
    for (const m of source.matchAll(/\$SITE(\/api\/[\w/-]+)/g)) chemins.add(m[1]);
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
