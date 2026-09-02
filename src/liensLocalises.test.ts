import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname);

/** Les fichiers de `src/`, comme les autres gardes structurels du projet. */
function fichiersSource(dossier: string, out: string[] = []): string[] {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.name.startsWith(".") || entree.name === "node_modules") continue;
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) fichiersSource(chemin, out);
    // Les tests sont écartés : ils NOMMENT les motifs qu'ils cherchent, à
    // commencer par celui-ci, et se désigneraient eux-mêmes comme fautifs.
    else if (/\.tsx?$/.test(entree.name) && !/\.test\.tsx?$/.test(entree.name)) out.push(chemin);
  }
  return out;
}

/**
 * Les liens internes passent tous par `Lien`, et les chemins par `useChemin`.
 *
 * Depuis que la langue vit dans l'adresse, un `href="/cgu"` écrit tel quel
 * renvoie sur une adresse sans langue : le middleware la rattrape et redirige
 * vers la langue NÉGOCIÉE, pas vers celle qu'on était en train de lire.
 * Quelqu'un qui lit l'application en japonais et clique sur « conditions »
 * changerait donc de langue au passage, sans rien avoir demandé.
 *
 * Le défaut ne casse rien : le lien marche, il emmène juste ailleurs. C'est
 * exactement le genre de chose qu'aucun test écrit à la main ne rattrape sur
 * le lien qu'on ajoutera demain — d'où un garde qui regarde le dossier plutôt
 * qu'une liste de fichiers connus.
 */
const IMPORT_LINK = /from\s+["']next\/link["']/;
const IMPORT_PATHNAME = /\busePathname\b/;

/** Chacune porte sa raison, et une troisième devrait faire douter du garde. */
const EXEMPTS_LINK = new Set([
  // Le seul endroit qui a le droit d'envelopper `next/link` : c'est lui qui
  // pose le préfixe.
  "components/Lien.tsx",
]);

const EXEMPTS_PATHNAME = new Set([
  // Il retire le préfixe : il lui faut donc le chemin entier.
  "lib/i18n/useChemin.ts",
  // Le sélecteur de langue réécrit l'adresse : il a besoin de l'ancienne, avec
  // sa langue, pour la remplacer.
  "lib/i18n/LocaleContext.tsx",
]);

describe("la langue voyage avec les liens", () => {
  const fichiers = fichiersSource(SRC);

  it("regarde vraiment des fichiers", () => {
    // Un dossier renommé rendrait les deux contrôles verts en ne lisant rien,
    // ce qui est exactement la forme d'erreur qu'ils existent pour empêcher.
    expect(fichiers.length).toBeGreaterThan(50);
  });

  it("aucun `next/link` hors de `Lien`", () => {
    const fautifs = fichiers
      .map((f) => relative(SRC, f))
      .filter((rel) => !EXEMPTS_LINK.has(rel))
      .filter((rel) => IMPORT_LINK.test(readFileSync(join(SRC, rel), "utf8")));
    expect(fautifs).toEqual([]);
  });

  it("aucun `usePathname` hors de `useChemin` et du sélecteur de langue", () => {
    const fautifs = fichiers
      .map((f) => relative(SRC, f))
      .filter((rel) => !EXEMPTS_PATHNAME.has(rel))
      .filter((rel) => {
        const source = readFileSync(join(SRC, rel), "utf8")
          // Un commentaire qui NOMME la fonction n'en est pas un appel.
          .replace(/\/\*[\s\S]*?\*\//g, " ")
          .replace(/\/\/[^\n]*/g, " ");
        return IMPORT_PATHNAME.test(source);
      });
    expect(fautifs).toEqual([]);
  });

  it("les deux gardes savent désigner un fautif", () => {
    // Sans ce contrôle, un motif qui ne trouve plus rien rendrait les deux
    // tests verts pour toujours. C'est arrivé sur le recensement des messages
    // d'API, et le test était resté vert en ne lisant plus rien.
    expect(IMPORT_LINK.test('import Link from "next/link";')).toBe(true);
    expect(IMPORT_PATHNAME.test('const p = usePathname();')).toBe(true);
  });
});

/**
 * Une navigation en dur emmène dans une autre langue que celle qu'on lit.
 *
 * `window.location.assign("/dashboard")` part sans préfixe. Le middleware la
 * rattrape et NÉGOCIE : le cookie d'abord, puis l'en-tête du navigateur, puis
 * l'anglais. Or ce cookie n'est écrit que par le sélecteur de langue —
 * quelqu'un qui arrive sur `/fr/login` par un lien partagé et n'y touche
 * jamais n'en a pas. Vérifié sur le serveur : sans cookie, `/dashboard` répond
 * 308 vers `/de/dashboard` avec un navigateur allemand, vers `/ja/dashboard`
 * avec un japonais.
 *
 * Autrement dit : on lit le site en français, on crée son compte, et on
 * atterrit en allemand. C'est le défaut déjà corrigé sur le lien de
 * récupération, au moment de la connexion plutôt qu'au moment du secours.
 */
const NAVIGATION_NUE = /location\s*\.\s*(?:assign|replace)\s*\(\s*[`"']\//;
const NAVIGATION_NUE_HREF = /location\s*\.\s*href\s*=\s*[`"']\//;

/**
 * `DesktopAuthHandler` navigue vers `/login` SANS préfixe, et c'est une
 * exception assumée : la fenêtre d'authentification de l'application installée
 * décide « la connexion est finie » en demandant « ce n'est plus /login ? ».
 * Une adresse préfixée y répondrait oui à la première page. Les copies
 * antérieures à 0.9.9 ne se corrigent pas à distance ; c'est la même exception
 * que celle du middleware, avec la même date de péremption.
 */
const EXEMPTS_NAVIGATION = new Set(["components/DesktopAuthHandler.tsx"]);

describe("les navigations en dur", () => {
  const fichiers = fichiersSource(SRC);

  it("portent toutes la langue", () => {
    // `fichiersSource` rend des chemins ABSOLUS : les rejoindre à `SRC` les
    // doublerait, et le garde tomberait sur un ENOENT au lieu de mesurer.
    const fautifs = fichiers
      .map((abs) => relative(SRC, abs))
      .filter((rel) => !EXEMPTS_NAVIGATION.has(rel))
      .filter((rel) => {
        const source = readFileSync(join(SRC, rel), "utf8");
        return NAVIGATION_NUE.test(source) || NAVIGATION_NUE_HREF.test(source);
      });
    expect(fautifs).toEqual([]);
  });

  it("n'a pas d'exemption qui ne désigne plus rien", () => {
    // Une dispense qui ne correspond à aucun fichier vivant est du code mort
    // qu'on a fini par admettre.
    for (const rel of EXEMPTS_NAVIGATION) {
      const source = readFileSync(join(SRC, rel), "utf8");
      expect(NAVIGATION_NUE.test(source) || NAVIGATION_NUE_HREF.test(source)).toBe(true);
    }
  });
});
