import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Aucune page ne doit être injoignable.
 *
 * `/waitlist` avait eu une page, un dictionnaire dans les six langues et un texte
 * qui explique que les cent places de la beta sont prises. **Rien n'y menait.**
 * Au moment précis où elle sert — le cent unième inscrit — la page
 * d'inscription affichait un cadre rouge et s'arrêtait là.
 *
 * Rien ne pouvait le signaler. TypeScript ne se plaint pas d'une page que
 * personne n'ouvre, et `codeMort.test.ts` exempte justement les fichiers que
 * Next.js charge par convention de nom : une page est toujours « importée »,
 * par le routeur.
 *
 * Ce test cherche donc autre chose : un chemin, écrit quelque part dans le
 * code, qui mène à cette page.
 */
const RACINE = join(__dirname, "app");

/**
 * Les pages qu'on atteint autrement que par un lien, chacune avec sa raison.
 *
 * Une exemption sans raison écrite finit par toutes les couvrir.
 */
const ENTREES_EXTERNES: Record<string, string> = {
  "/": "l'adresse du site, tapée ou suivie depuis ailleurs",
  "/connexion-app": "ouverte par l'application de bureau à la fin de son OAuth",
  "/recuperation/valider": "atteinte par le lien du courriel de récupération",
  "/obs/[jeton]": "adresse recopiée à la main dans OBS, jamais cliquée",
};

/** Toutes les pages du dossier `app`, sous forme de chemin d'URL. */
function pages(dossier: string, prefixe = ""): string[] {
  const trouvees: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const complet = join(dossier, entree);
    if (statSync(complet).isDirectory()) {
      // `(groupe)` et `api` ne produisent pas de page.
      if (entree === "api") continue;
      // `[locale]` non plus : c'est la langue, et le reste du projet ne
      // connaît que le chemin sans elle — c'est sous cette forme que les liens
      // sont écrits, et donc sous cette forme qu'il faut les chercher.
      const segment = entree.startsWith("(") || entree === "[locale]" ? "" : `/${entree}`;
      trouvees.push(...pages(complet, prefixe + segment));
    } else if (entree === "page.tsx" || entree === "page.ts") {
      trouvees.push(prefixe || "/");
    }
  }
  return trouvees;
}

/** Tout le code source, concaténé : c'est là qu'on cherche les chemins. */
function sources(dossier: string): string {
  let texte = "";
  for (const entree of readdirSync(dossier)) {
    const complet = join(dossier, entree);
    if (statSync(complet).isDirectory()) {
      if (entree === "generated") continue;
      texte += sources(complet);
    } else if (/\.(ts|tsx)$/.test(entree) && !entree.endsWith(".test.ts") && !entree.endsWith(".test.tsx")) {
      texte += readFileSync(complet, "utf8") + "\n";
    }
  }
  return texte;
}

const CODE = sources(join(__dirname));

/**
 * Les chemins vers lesquels le code fait NAVIGUER.
 *
 * Pas les chemins qu'il mentionne : la première version cherchait la chaîne
 * n'importe où, et `/waitlist` passait alors pour joignable parce qu'elle figurait
 * dans la liste des pages publiques et dans celle de la barre de navigation.
 * Deux listes d'appartenance, aucun chemin. Le sabotage — retirer la
 * redirection — laissait le test au vert : il ne prouvait rien.
 *
 * On ne retient donc que ce qui emmène quelque part : un `href`, un
 * `router.push`, un `redirect`.
 */
function ciblesDeNavigation(code: string): string[] {
  const cibles: string[] = [];
  const motifs = [
    // href="/x", href={"/x"}, href={`/x/${...}`}
    /href=\{?["'`]([^"'`{}$]+)/g,
    // { href: "/x", ... } — les listes d'onglets et de rubriques
    /href:\s*["'`]([^"'`]+)/g,
    // router.push("/x"), router.replace("/x"), redirect("/x")
    /(?:router\.(?:push|replace)|redirect)\(\s*["'`]([^"'`]+)/g,
  ];
  for (const motif of motifs) {
    for (const trouve of code.matchAll(motif)) cibles.push(trouve[1]);
  }
  return cibles;
}

const CIBLES = ciblesDeNavigation(CODE);

/**
 * Une navigation mène-t-elle à cette page ?
 *
 * Un segment dynamique se satisfait de son préfixe : `/calculateur/${slug}`
 * mène bien à `/calculateur/[jeu]`, et on ne saura jamais lister les valeurs.
 * La requête et l'ancre sont écartées : `/settings?rubrique=jeux` mène aux
 * réglages.
 */
function estAtteignable(route: string): boolean {
  const dynamique = route.indexOf("/[");
  const cible = dynamique === -1 ? route : route.slice(0, dynamique + 1);
  return CIBLES.some((c) => {
    const nu = c.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
    return dynamique === -1 ? nu === cible : c.startsWith(cible);
  });
}

describe("les pages du site", () => {
  const routes = pages(RACINE).sort();

  /**
   * Le test suivant prouve que la RECHERCHE cherche ; il ne dit rien du
   * recensement des pages. Un dossier renommé rendrait `routes` vide, et la
   * liste des orphelines le serait aussi — vert sur rien.
   */
  it("recense vraiment des pages", () => {
    expect(routes.length).toBeGreaterThan(10);
    // Le seuil se recalibre quand des liens disparaissent : l'allègement de
    // la page d'accueil en a retiré une dizaine. Il reste très au-dessus de
    // zéro, qui est le seul chiffre qu'un extracteur cassé rendrait.
    expect(CIBLES.length).toBeGreaterThan(30);
  });

  it("sont toutes joignables par un chemin écrit quelque part", () => {
    const orphelines = routes.filter(
      (r) => !(r in ENTREES_EXTERNES) && !estAtteignable(r),
    );
    expect({ orphelines }).toEqual({ orphelines: [] });
  });

  it("cherche vraiment — une page inventée doit ressortir orpheline", () => {
    // Sans ce contrôle, une expression trop permissive rendrait « joignable »
    // pour n'importe quoi et le test ne prouverait rien.
    expect(estAtteignable("/page-qui-nexiste-pas")).toBe(false);
  });

  it("n'exempte que des pages qui existent", () => {
    const fantomes = Object.keys(ENTREES_EXTERNES).filter((r) => !routes.includes(r));
    expect({ fantomes }).toEqual({ fantomes: [] });
  });
});
