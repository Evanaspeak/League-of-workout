import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Ce que l'écran des réglages LIT, la route doit le RENDRE.
 *
 * Le défaut que ce garde ferme a vécu depuis l'étape 05 : `/api/settings`
 * filtrait sa réponse par `comptePublic`, c'est-à-dire par le filtre de
 * DIFFUSION, qui retire les neuf colonnes de « Ton corps » et le jeton du
 * profil public. Elles étaient donc écrites en base et jamais relues. On
 * choisissait « Perdre », on réglait sa variante de formule, son niveau
 * d'activité, son poids visé, ses trois mesures au mètre-ruban ; on
 * rechargeait la page, et tout était revenu à « Rien pour l'instant ».
 *
 * Le profil public était pire encore : l'écran le montrait ÉTEINT pendant que
 * l'adresse continuait de fonctionner. Un réglage de confidentialité qui ment
 * sur son propre état.
 *
 * **Rien ne pouvait le signaler.** Les tests de la route vérifient ce qui est
 * ÉCRIT, `compte.test.ts` vérifie que chaque colonne est CLASSÉE — jamais qui
 * la lit — et le parcours navigateur de « Ton corps » ne rechargeait pas la
 * page. Le commentaire de `compte.ts` écrivait pourtant la règle depuis le
 * premier jour : « elles se demandent par `/api/settings` ». Une garantie
 * décrite qui n'existe pas se relit comme une garantie.
 *
 * Le contrôle porte sur le BRANCHEMENT et non sur un nom : il lit dans la
 * ROUTE quel filtre elle applique, puis dans `compte.ts` ce que ce filtre
 * retire. Remettre `comptePublic` le fait tomber.
 */

const RACINE = join(__dirname, "app");
const ROUTE = join(RACINE, "api", "settings", "route.ts");
const COMPTE = join(__dirname, "lib", "compte.ts");

/** Le ou les écrans qui demandent `/api/settings` et lisent le compte. */
function consommateurs(dossier: string, trouves: string[] = []): string[] {
  for (const entree of readdirSync(dossier)) {
    const complet = join(dossier, entree);
    if (statSync(complet).isDirectory()) {
      if (entree === "api") continue;
      consommateurs(complet, trouves);
    } else if (entree.endsWith(".tsx") && !entree.includes(".test.")) {
      const texte = readFileSync(complet, "utf8");
      if (texte.includes('fetch("/api/settings")')) trouves.push(complet);
    }
  }
  return trouves;
}

/** Les champs du compte que cet écran lit dans la réponse. */
function champsLus(source: string): string[] {
  const lus = new Set<string>();
  for (const t of source.matchAll(/\.user\??\.([A-Za-z_]\w*)/g)) lus.add(t[1]);
  return [...lus].sort();
}

/** Le contenu d'une liste `const NOM = [ … ] as const;` de `compte.ts`. */
function liste(source: string, nom: string): string[] {
  const bloc = source.match(new RegExp(`const ${nom} = \\[([\\s\\S]*?)\\] as const;`));
  if (!bloc) throw new Error(`liste ${nom} introuvable dans compte.ts`);
  return [...bloc[1].matchAll(/"(\w+)"/g)].map((t) => t[1]);
}

describe("les réglages relisent ce qu'ils écrivent", () => {
  const route = readFileSync(ROUTE, "utf8");
  const compte = readFileSync(COMPTE, "utf8");
  const ecrans = consommateurs(RACINE);

  const tousLesChampsLus = () => [
    ...new Set(ecrans.flatMap((f) => champsLus(readFileSync(f, "utf8")))),
  ].sort();

  const SECRETS = liste(compte, "NE_SORTENT_PAS");
  const HORS_DIFFUSION = liste(compte, "HORS_DIFFUSION");

  it("trouve l'écran, la route et les deux listes", () => {
    /**
     * Un garde épinglé sur un CHEMIN devient muet le jour où le fichier bouge,
     * c'est-à-dire le jour où l'on aurait besoin de lui. On cherche donc les
     * écrans par leur FORME — ceux qui demandent la route — et on refuse de
     * continuer s'il n'y en a aucun.
     */
    expect(ecrans.length).toBeGreaterThan(0);
    expect(SECRETS.length).toBeGreaterThan(4);
    expect(HORS_DIFFUSION.length).toBeGreaterThan(4);
    // Sans ce compte, un extracteur cassé rendrait zéro champ lu et la
    // comparaison d'en dessous serait verte sur rien.
    expect(tousLesChampsLus().length).toBeGreaterThan(8);
  });

  /**
   * Quel filtre la route applique-t-elle vraiment ?
   *
   * On le lit dans le GET plutôt que de le supposer : c'est le BRANCHEMENT
   * qu'on veut tenir, pas la présence d'un nom quelque part dans le fichier.
   */
  function retireesParLaRoute(): string[] {
    const get = route.match(/export async function GET\(\)[\s\S]*?\n\}/);
    if (!get) throw new Error("le GET de /api/settings est introuvable");
    if (/user:\s*compteReglages\(/.test(get[0])) return SECRETS;
    if (/user:\s*comptePublic\(/.test(get[0])) return [...SECRETS, ...HORS_DIFFUSION];
    throw new Error("le GET de /api/settings ne filtre le compte par aucun filtre connu");
  }

  it("ne lit aucun champ que la route retire de sa réponse", () => {
    const retirees = new Set(retireesParLaRoute());
    const perdus = tousLesChampsLus().filter((c) => retirees.has(c));
    expect({ perdus }).toEqual({ perdus: [] });
  });

  it("cherche vraiment — un champ retiré doit ressortir perdu", () => {
    // L'état sain du dépôt est zéro trouvaille : les fichiers réels ne
    // distinguent donc pas un tri juste d'un tri qui accepterait tout.
    const retirees = new Set(retireesParLaRoute());
    expect(retirees.has("passwordHash")).toBe(true);
    expect(champsLus('const x = s.user?.passwordHash;').filter((c) => retirees.has(c)))
      .toEqual(["passwordHash"]);
  });
});
