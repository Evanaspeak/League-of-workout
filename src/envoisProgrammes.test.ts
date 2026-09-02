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
