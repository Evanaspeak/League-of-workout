import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sansCommentaires } from "./test/sansCommentaires";

/**
 * Une quantité rendue BRUTE dans du JSX.
 *
 * `{etat.prochain.avancement} / {etat.prochain.seuil}` écrivait « 15360 / 25000 »
 * dans les six langues, sur le panneau des paliers — donc sur CHAQUE écran
 * connecté, puisqu'il vit dans le rail. Le français écrit « 15 360 », l'allemand
 * « 15.360 », le japonais « 15,360 ».
 *
 * Trouvé en lisant l'écran en japonais sur un compte à mille neuf cent vingt
 * parties. Deux lignes plus haut, le même composant écrit
 * `nombre.format(etat.souffrance.points)` : la règle était appliquée à un de
 * ses deux endroits, ce que ce journal trouve plus souvent que tout le reste.
 *
 * **Ce que ce garde ne peut PAS être.** Il n'existe pas de règle « aucun nombre
 * nu en JSX » : un numéro de niveau, une valeur de formulaire et un attribut
 * ARIA doivent rester nus, et le journal l'écrit déjà pour `String(`. Le
 * discriminant est donc le NOM du champ — une famille fermée de quantités qui
 * n'ont pas de borne — et il ne s'applique qu'aux ENFANTS de JSX, jamais aux
 * attributs.
 *
 * **Et il écarte les DICTIONNAIRES**, ce que le premier jet ne faisait pas :
 * `tt.xp` est le MOT « XP », pas un nombre, et le garde accusait la ligne qui
 * met justement l'XP en forme. C'est la borne d'identifiant que
 * `phraseAssemblee.test.ts` avait déjà dû poser pour la même raison — `t`,
 * `tt`, ou `t` suivi d'une majuscule.
 */

/** Les champs dont la valeur n'a pas de plafond. */
const SANS_PLAFOND = [
  "avancement", "seuil", "points", "total", "totalPoints", "pointsPayes",
  "xp", "restant", "dus", "cumul",
] as const;

const CHAMP = `(?:${SANS_PLAFOND.join("|")})`;
/**
 * Un enfant de JSX, et pas un attribut.
 *
 * `max={l.dus}` et `aria-valuenow={…}` doivent rester des nombres nus : le
 * premier borne un `<input type="number">`, le second est une valeur ARIA. Ce
 * qui les distingue est le `=` qui précède l'accolade.
 */
export const NOMBRE_NU = new RegExp(
  `(^|[^=])\\{(?!t\\b|tt\\b|t[A-Z])[a-zA-Z_][A-Za-z0-9_.?\\[\\]]*\\.${CHAMP}\\}`,
);

export function nombresNus(source: string): string[] {
  return source
    .split("\n")
    .filter((l) => NOMBRE_NU.test(l))
    .map((l) => l.trim());
}

function tsx(dossier: string, sortie: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) {
      if (e.name === "generated" || e.name === "node_modules") continue;
      tsx(chemin, sortie);
    } else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) sortie.push(chemin);
  }
  return sortie;
}

describe("aucune quantité sans plafond n'est rendue brute", () => {
  const SRC = join(__dirname);
  const sources = tsx(SRC).map((f) => [f.replace(SRC, "src"), sansCommentaires(readFileSync(f, "utf8"))] as const);

  it("le recensement est vide", () => {
    const fautifs = sources.flatMap(([f, s]) => nombresNus(s).map((l) => `${f} : ${l.slice(0, 90)}`));
    expect(fautifs).toEqual([]);
  });

  it("et il a réellement lu quelque chose", () => {
    // Sans ce témoin, un dossier renommé rendrait le contrôle vert.
    expect(sources.length).toBeGreaterThan(50);
  });

  it("le tri se comporte comme annoncé sur des cas fabriqués", () => {
    // L'état sain est ZÉRO trouvaille : les fichiers réels ne distinguent pas
    // un motif juste d'un motif aveugle.
    for (const cas of [
      "{etat.prochain.avancement} / {etat.prochain.seuil}",
      "<b>{u.points}</b>",
      "{resultat.total}",
      "{a.b.c.xp}",
    ]) expect(nombresNus(cas).length).toBe(1);
    for (const cas of [
      // Un attribut : la valeur doit rester un nombre.
      "max={l.dus}",
      'aria-valuenow={data.premiereSemaine.avancement}',
      // Déjà mis en forme.
      "{nombre.format(etat.souffrance.points)}",
      "{chiffre(resultat.points)}",
      // Un champ qui n'est pas dans la famille.
      "{etat.niveau.niveau}",
      "{g.kills}",
      // Un libellé de dictionnaire, pas un nombre : c'est le mot « XP ».
      "{tt.xp}",
      "{t.points}",
      "{tExo.total}",
    ]) expect(nombresNus(cas)).toEqual([]);
  });
});
