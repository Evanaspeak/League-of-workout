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
  "/p/[jeton]": "adresse que son propriétaire copie et partage lui-même ; la lister ici reviendrait à publier les liens",
  "/introuvable": "cible d'une RÉÉCRITURE du middleware, pas d'un lien : personne ne clique vers sa propre 404, et l'adresse affichée reste celle qu'on avait demandée",
};

/** Toutes les ROUTES d'API, sous forme de chemin d'URL. */
function routesApi(dossier: string, prefixe = "/api"): string[] {
  const trouvees: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const complet = join(dossier, entree);
    if (statSync(complet).isDirectory()) trouvees.push(...routesApi(complet, `${prefixe}/${entree}`));
    else if (entree === "route.ts" || entree === "route.tsx") trouvees.push(prefixe);
  }
  return trouvees;
}

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

/** Toutes les routes d'API, lues une fois. */
const API = routesApi(join(RACINE, "api"));

/**
 * Les cibles de navigation qui ne mènent à rien.
 *
 * Une cible peut être une page OU une route d'API — l'image du bilan et
 * l'export de données sont des `<a href>` vers `/api/…`, ce qui est légitime :
 * ce sont des fichiers qu'on ouvre, pas des écrans.
 */
function mortes(cibles: string[], routes: string[]): string[] {
  const existe = (c: string) =>
    [...routes, ...API].some((r) => {
      const i = r.indexOf("/[");
      return i === -1 ? r === c : c.startsWith(r.slice(0, i + 1));
    });
  return [...new Set(cibles)]
    .map((c) => c.split(/[?#]/)[0].replace(/\/+$/, "") || "/")
    // Ce qui ne commence pas par « / » n'est pas une adresse interne : une
    // ancre, un `mailto:`, un lien vers un autre site.
    .filter((c) => c.startsWith("/") && !c.startsWith("//"))
    .filter((c) => !existe(c))
    .sort();
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

  /**
   * L'autre sens, et il manquait.
   *
   * Ce fichier vérifiait qu'aucune PAGE n'est orpheline — que tout ce qui
   * existe est atteignable. Il ne disait rien de la réciproque : qu'aucun LIEN
   * ne mène nulle part. Les deux défauts sont symétriques et se paient de la
   * même façon, en silence : une page sans lien ne se voit pas, et un lien
   * mort ne se voit qu'au clic, chez quelqu'un.
   *
   * Il pèse le plus lourd sur les pages publiques, qui sont le seul canal
   * d'acquisition du produit : un moteur qui suit un lien vers une 404 apprend
   * quelque chose de faux sur le site.
   *
   * Une cible peut être une page OU une route d'API — l'image du bilan et
   * l'export de données sont des `<a href>` vers `/api/…`, ce qui est
   * légitime : ce sont des fichiers qu'on ouvre, pas des écrans.
   */
  it("ne fait naviguer vers rien qui n'existe pas", () => {
    const nulle_part = mortes(CIBLES, routes);
    expect({ nulle_part }).toEqual({ nulle_part: [] });
    // Témoin : les routes d'API ont été lues. Il ne sert que le jour où plus
    // aucun lien ne vise `/api/…` — aujourd'hui les deux qui restent font
    // tomber l'assertion d'au-dessus avant lui.
    expect(API.length).toBeGreaterThan(30);
  });

  it("cherche vraiment — une cible inventée doit ressortir morte", () => {
    // Le tri s'éprouve sur un cas FABRIQUÉ : l'état sain du dépôt est zéro
    // trouvaille, donc les cibles réelles ne distinguent pas un tri juste d'un
    // tri qui accepterait tout. Et il doit LAISSER passer les trois formes
    // légitimes : une page, une route d'API, un segment dynamique.
    expect(mortes(["/page-qui-nexiste-pas"], routes)).toEqual([
      "/page-qui-nexiste-pas",
    ]);
    expect(
      mortes(["/settings?rubrique=jeux", "/api/user/export", "/calculateur/valorant"], routes),
    ).toEqual([]);
  });
});
