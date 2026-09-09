import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { sansCommentaires } from "@/test/sansCommentaires";

/**
 * La palette, et les deux façons de s'en écarter sans que rien ne le dise.
 *
 * Elle vit dans `src/app/styles/base.css`, et le bloc porte lui-même la trace
 * d'une migration : « Aliases legacy (anciens tokens gold/cyan → nouvelle
 * palette) ». Le pont a été posé pour que le code d'avant continue de rendre
 * la bonne couleur. Il lui manquait une planche.
 *
 * **Premier défaut : une variable qu'on emploie et que personne ne déclare.**
 * `var(--blue, #0bc4e3)` s'écrivait à trois endroits — les pastilles de titre
 * du rail, donc TOUS les écrans connectés, et le profil public. `--blue` n'a
 * jamais existé : ni dans la palette, ni parmi les alias. C'est donc le repli
 * qui rendait, et le repli est le cyan d'avant la migration, à côté d'un
 * `--signal` qui vaut `#6E9BFF`. Deux bleus à l'écran, aucune erreur, aucun
 * test rouge. `--panel-border` était dans le même cas, une fois.
 *
 * Le contrôle porte donc sur la DÉCLARATION et pas sur le repli : un repli est
 * légitime — la coquille de diffusion ne charge aucune police, donc
 * `var(--font-heading, sans-serif)` y sert pour de bon. Ce qui ne l'est pas,
 * c'est de nommer une variable que rien ne définit.
 *
 * **Second défaut : un littéral qui redit une variable.** Il ne casse rien le
 * jour où on l'écrit ; il casse le jour où la palette bouge, puisqu'il ne
 * bouge pas avec elle. C'est ce qui est arrivé à l'or : `#C8AA6E` est resté
 * dans les deux images de partage et sur la 404 pendant que `--gold` passait
 * à `#FFB454`. La carte partagée, elle, avait suivi — donc le produit postait
 * deux ors différents sur Discord.
 *
 * **Troisième défaut : la même couleur SOUS TRANSPARENCE.** Un littéral en
 * `rgba()` ne ressemble à aucun hexadécimal, donc le contrôle ci-dessus lui
 * était aveugle. Cent soixante-dix-huit occurrences y vivaient, onze couleurs,
 * dont dix qui portaient DÉJÀ un nom dans la palette.
 *
 * **Ce que ce garde ne couvre PAS**, écrit plutôt que laissé à découvrir : la
 * transparence en notation moderne (`#98A2B080`, `rgb(152 162 176 / 20%)`).
 * Le dépôt n'en contient aucune — vérifié — et un motif qui les couvrirait
 * demanderait de normaliser trois écritures avant de comparer. Le jour où
 * l'une paraît, c'est ici qu'il faut l'ajouter.
 */

const SRC = join(process.cwd(), "src");

function fichiers(dossier: string, ext: string[]): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dossier)) {
    const p = join(dossier, e);
    if (statSync(p).isDirectory()) out.push(...fichiers(p, ext));
    else if (ext.some((x) => e.endsWith(x))) out.push(p);
  }
  return out;
}

const relatif = (p: string) => p.slice(process.cwd().length + 1);

/**
 * Les fichiers qui ne peuvent pas lire la palette, et pourquoi.
 *
 * Aucun n'est une commodité : chacun se rend dans un contexte où il n'y a
 * aucun `:root` à interroger. Une dixième entrée devrait faire se demander si
 * la règle sert encore.
 */
const SANS_FEUILLE: Record<string, string> = {
  "src/app/[locale]/opengraph-image.tsx": "dessinée par next/og, sans feuille de style",
  "src/app/[locale]/apple-icon.tsx": "dessinée par next/og, sans feuille de style",
  "src/app/[locale]/icon.tsx": "dessinée par next/og, sans feuille de style",
  "src/app/api/pwa-icon/route.tsx": "dessinée par next/og, sans feuille de style",
  "src/app/api/seance/image/route.tsx": "dessinée par next/og, sans feuille de style",
  "src/app/api/bilan/image/route.tsx": "dessinée par next/og, sans feuille de style",
  "src/app/not-found.tsx": "frontière 404 de la racine : elle fournit son propre document, sans feuille",
  "src/components/CorpsIntrouvable.tsx": "rendu depuis cette frontière-là autant que depuis la page localisée",
  "src/app/[locale]/layout.tsx": "themeColor est une métadonnée lue par le navigateur, pas une valeur CSS",
  "src/lib/email.ts": "un courriel HTML ne charge aucune feuille : les clients de messagerie ne résolvent pas les propriétés personnalisées",
  "src/app/manifest.ts": "le manifeste est lu par le système d'exploitation, qui n'a pas de CSS",
};

/** Tout ce qui déclare une variable, quel que soit le moyen. */
function declarees(): Set<string> {
  const out = new Set<string>();
  for (const f of fichiers(SRC, [".css"])) {
    for (const m of readFileSync(f, "utf8").matchAll(/--([a-z0-9-]+)\s*:/g)) out.add(m[1]);
  }
  for (const f of fichiers(SRC, [".ts", ".tsx"])) {
    const t = readFileSync(f, "utf8");
    // next/font : `variable: "--font-heading"`
    for (const m of t.matchAll(/variable:\s*"--([a-z0-9-]+)"/g)) out.add(m[1]);
    // propriété posée en ligne sur un élément : `["--teinte" as string]: …`
    for (const m of t.matchAll(/\[\s*"--([a-z0-9-]+)"/g)) out.add(m[1]);
  }
  return out;
}

/** Les valeurs littérales de la palette, alias résolus. */
function valeursPalette(): Map<string, string[]> {
  const brut = new Map<string, string>();
  for (const f of fichiers(SRC, [".css"])) {
    for (const m of readFileSync(f, "utf8").matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)) {
      if (!brut.has(m[1])) brut.set(m[1], m[2].trim());
    }
  }
  const resoudre = (v: string, n = 0): string => {
    const m = /^var\(\s*--([a-z0-9-]+)\s*\)$/.exec(v.trim());
    return m && n < 5 && brut.has(m[1]) ? resoudre(brut.get(m[1])!, n + 1) : v.trim();
  };
  const out = new Map<string, string[]>();
  for (const [nom, v] of brut) {
    const val = resoudre(v).toLowerCase().replace(/\s+/g, "");
    if (!/^(#[0-9a-f]{3,8}|rgba?\()/.test(val)) continue;
    out.set(val, [...(out.get(val) ?? []), nom]);
  }
  return out;
}

const COULEUR = /#[0-9A-Fa-f]{3,8}\b|rgba?\([^)]*\)/g;

/** Un littéral en composantes, ou `null` s'il n'en est pas un. */
function composantes(v: string): [number, number, number, number] | null {
  const t = v.trim().toLowerCase();
  let m = /^#([0-9a-f]{3})$/.exec(t);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16)).concat(1) as [number, number, number, number];
  m = /^#([0-9a-f]{6})$/.exec(t);
  if (m) {
    const h = m[1];
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).concat(1) as [number, number, number, number];
  }
  m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/.exec(t);
  if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
  return null;
}

/**
 * Huit niveaux sur 255 : trois pour cent, sous le seuil de perception sur un
 * aplat. Au-delà, l'écart SE VOIT, donc ce n'est plus un accident mais un
 * choix — et un choix ne se corrige pas dans un test.
 */
const CHEVEU = 8;

/** La couleur nommée dont ce littéral est à un cheveu — jamais lui-même. */
function laPlusProche(
  litteral: string,
  nommees: { noms: string[]; c: [number, number, number, number] }[],
): { d: number; nom: string } | null {
  const c = composantes(litteral);
  if (!c) return null;
  let meilleur: { d: number; nom: string } | null = null;
  for (const p of nommees) {
    if (Math.abs(p.c[3] - c[3]) > 0.001) continue; // une autre transparence est une autre question
    const d = Math.max(...[0, 1, 2].map((i) => Math.abs(p.c[i] - c[i])));
    if (!meilleur || d < meilleur.d) meilleur = { d, nom: p.noms[0] };
  }
  // Distance nulle : c'est la couleur elle-même, et c'est l'autre contrôle qui
  // en décide — celui-ci ne parle que de ce qui PASSE à côté.
  return meilleur && meilleur.d > 0 && meilleur.d <= CHEVEU ? meilleur : null;
}

describe("la palette", () => {
  it("n'emploie que des variables que quelque chose déclare", () => {
    const connues = declarees();
    const fautives: string[] = [];
    for (const f of fichiers(SRC, [".ts", ".tsx", ".css"])) {
      // Privé de ses commentaires : sans ce retrait, ce fichier-ci tombe sur
      // le `var(--blue)` de sa propre explication. Le piège est recensé trois
      // fois au journal, et `sansCommentaires` existe pour lui.
      const src = sansCommentaires(readFileSync(f, "utf8"));
      for (const m of src.matchAll(/var\(\s*--([a-z0-9-]+)/g)) {
        if (!connues.has(m[1])) fautives.push(`${relatif(f)} : var(--${m[1]})`);
      }
    }
    expect(fautives).toEqual([]);
    expect(connues.size).toBeGreaterThan(20); // témoin : le recensement a lu quelque chose
  });

  it("n'écrit pas en dur une couleur qui a déjà un nom", () => {
    const palette = valeursPalette();
    const fautifs: string[] = [];
    let examines = 0;
    /**
     * Les FEUILLES aussi, et c'était le trou.
     *
     * Ce contrôle lisait `.tsx` puis `.ts` — le journal raconte l'élargissement
     * — et jamais `.css`, pendant que le contrôle des transparences, quarante
     * lignes plus bas, les lit depuis le premier jour. Deux contrôles du même
     * fichier, l'un qui ouvre les feuilles et l'autre non.
     *
     * Ce qui vivait dedans : le dégradé de marque, écrit dans DEUX feuilles,
     * qui recopiait `--ember` en clair. C'est exactement la correction de
     * « Une couleur écrite dix fois, dans deux paquets, sans nom » — appliquée
     * à un de ses deux endroits.
     */
    for (const f of fichiers(SRC, [".tsx", ".ts", ".css"])) {
      const rel = relatif(f);
      if (rel in SANS_FEUILLE || rel.endsWith(".test.ts")) continue;
      examines += 1;
      const src = sansCommentaires(readFileSync(f, "utf8"));
      for (const m of src.matchAll(COULEUR)) {
        // `base.css` DÉCLARE ces valeurs : c'est le seul endroit où une
        // couleur a le droit d'être écrite en clair, et l'exemption porte sur
        // la LIGNE de déclaration, jamais sur le fichier — ses deux halos de
        // fond emploient la palette autant qu'ils la déclarent.
        const debut = src.lastIndexOf("\n", m.index) + 1;
        if (/^\s*--[a-z0-9-]+:/.test(src.slice(debut, m.index))) continue;
        const v = m[0].toLowerCase().replace(/\s+/g, "");
        const noms = palette.get(v);
        if (noms) fautifs.push(`${rel} : ${m[0]} vaut --${noms[0]}`);
      }
    }
    expect(fautifs).toEqual([]);
    expect(examines).toBeGreaterThan(200); // témoin : un dossier renommé ne rend pas ce test vert
    expect(palette.size).toBeGreaterThan(8);
  });

  /**
   * Une couleur À UN CHEVEU d'une couleur nommée, et le contrôle d'au-dessus
   * ne peut pas la voir : il compare des CHAÎNES, donc il attrape « tu as
   * réécrit une couleur qu'on a nommée » et jamais « tu en as inventé une
   * qu'on n'a pas ».
   *
   * **Et le presque est PIRE que l'exact.** Un doublon exact rend la bonne
   * couleur : le défaut est d'entretien. Un presque rend un TROISIÈME
   * gris-noir que personne n'a choisi, à côté des deux qu'on a — et il ne se
   * voit pas, puisque c'est justement sa définition.
   *
   * Ce qui vivait dedans, mesuré : cinq littéraux, dont **trois noirs
   * différents** qui voulaient tous dire `--ink` (`#0d1117`, `#0b0d12`,
   * `#0B0E12`, à 6, 1 et 1 niveaux), un `--steel` à 2 et un `--bone` à 7.
   *
   * **Le seuil porte sa raison, pas un ajustement aux données du jour** : huit
   * niveaux sur 255 font trois pour cent, sous le seuil de perception sur un
   * aplat. Ce qu'il ne voit pas est écrit plutôt que tu — le blanc de drapeau
   * de `Drapeau.tsx` est à 9 de `--bone`, l'ambre de `/beta` à 10 de
   * `--amber` — et ces deux-là ne sont pas des accidents : le premier est une
   * couleur nationale, le second un écart qui SE VOIT, donc un arbitrage.
   *
   * **Ce qu'il ne compare PAS : deux transparences différentes.** C'est
   * délibéré — `--line` et `--line-strong` ne diffèrent QUE par l'alpha, donc
   * comparer les composantes seules ferait crier sur deux jetons parfaitement
   * légitimes. Le prix est écrit : le voile des fenêtres vaut
   * `rgba(6,8,10,0.82)` sur le site et `rgba(6,8,11,0.72)` dans la coquille —
   * deux voiles à un niveau l'un de l'autre, qu'aucun jeton ne nomme, et que ce
   * contrôle ne verra jamais. Ça part dans les questions avec les couleurs
   * inventées.
   *
   * **Il lit les fichiers DISPENSÉS, contrairement au contrôle d'au-dessus**,
   * et la distinction est le cœur de la règle : une image de `next/og` ou un
   * courriel HTML ne peut pas résoudre `var()`, donc elle a le droit d'écrire
   * la couleur en clair — elle n'a pas le droit d'en inventer une autre.
   */
  it("n'écrit pas une couleur à un cheveu d'une couleur nommée", () => {
    const nommees = [...valeursPalette().entries()]
      .map(([v, noms]) => ({ noms, c: composantes(v) }))
      .filter((x): x is { noms: string[]; c: [number, number, number, number] } => x.c !== null);

    const fautifs: string[] = [];
    let examines = 0;
    /**
     * La COQUILLE aussi, et c'est là que la dérive serait le plus muette.
     *
     * Elle se construit sans le paquet du site, donc elle écrit la palette en
     * clair — sept couleurs exactes aujourd'hui : `--ink`, `--bone`, `--amber`,
     * `--flame`, `--victory`, `--loss`, `--signal`. Une seule était comparée,
     * `--flame`, par le contrôle du pont juste en dessous. Les six autres
     * pouvaient glisser d'un niveau sans que rien ne le dise — et la seule
     * machine capable de le voir est celle de quelqu'un d'autre, en jeu.
     */
    for (const racine of [SRC, join(process.cwd(), "desktop/src")]) {
      for (const f of fichiers(racine, [".tsx", ".ts", ".css", ".js", ".html"])) {
        const rel = relatif(f);
        if (rel.endsWith(".test.ts") || rel.endsWith(".test.js")) continue;
        examines += 1;
        const src = sansCommentaires(readFileSync(f, "utf8"));
        for (const m of src.matchAll(COULEUR)) {
          const debut = src.lastIndexOf("\n", m.index) + 1;
          if (/^\s*--[a-z0-9-]+:/.test(src.slice(debut, m.index))) continue;
          const proche = laPlusProche(m[0], nommees);
          if (proche) fautifs.push(`${rel} : ${m[0]} est à ${proche.d} de --${proche.nom}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
    expect(examines).toBeGreaterThan(200); // témoin : un dossier renommé ne rend pas ce test vert
    expect(nommees.length).toBeGreaterThan(8);

    /**
     * Le tri s'éprouve sur des cas FABRIQUÉS, et il le faut : l'état sain du
     * dépôt est zéro trouvaille, donc les fichiers réels ne distinguent pas un
     * seuil qui trie d'un seuil qui ne voit rien.
     */
    const ink = nommees.find((n) => n.noms.includes("ink"))!;
    expect(laPlusProche("#0C0E11", [ink])).toBeNull();          // la couleur elle-même
    expect(laPlusProche("#0d1117", [ink])?.d).toBe(6);          // le cas qui a motivé la règle
    expect(laPlusProche("#FF4D2E", [ink])).toBeNull();          // une autre couleur, franchement
    expect(laPlusProche("rgba(12,14,17,0.5)", [ink])).toBeNull(); // transparence différente
  });

  it("ne garde pas une dispense qui ne désigne plus rien", () => {
    const palette = valeursPalette();
    const inutiles: string[] = [];
    for (const [chemin, raison] of Object.entries(SANS_FEUILLE)) {
      expect(raison.length).toBeGreaterThan(20);
      let t: string;
      try { t = sansCommentaires(readFileSync(join(process.cwd(), chemin), "utf8")); }
      catch { inutiles.push(`${chemin} n'existe plus`); continue; }
      const porte = [...t.matchAll(COULEUR)]
        .some((m) => palette.has(m[0].toLowerCase().replace(/\s+/g, "")));
      if (!porte) inutiles.push(`${chemin} n'écrit plus aucune couleur de la palette`);
    }
    expect(inutiles).toEqual([]);
  });

  /**
   * Une couleur de la palette SOUS TRANSPARENCE reste une couleur de la
   * palette, et le contrôle d'au-dessus ne la voyait pas : il compare des
   * chaînes, donc `rgba(152,162,176,0.2)` ne ressemble en rien à `#98A2B0`.
   *
   * Ce qui vivait dans cet angle mort : **178 littéraux, onze couleurs**, dont
   * `--steel` cent trente-quatre fois à dix-neuf transparences et `--bone`
   * trente-six fois à vingt-quatre. Et **dix d'entre eux avaient déjà un
   * nom** — `--victory-soft`, `--signal-soft`, `--amber-soft`, `--gold-dim`
   * sont déclarés dans la palette, et le même rgba était réécrit à la main à
   * côté. Deux façons d'écrire la même chose, dont une seule suit la palette.
   *
   * Le témoin de la divergence est dans le recensement lui-même :
   * `rgba(236,239,244,0.60)` ET `rgba(236,239,244,0.6)` coexistaient. Personne
   * ne lisait une valeur partagée, sinon elles n'auraient qu'une écriture.
   *
   * **La VALEUR est identique, le PIXEL ne l'est pas tout à fait**, et il
   * fallait mesurer pour le savoir : `color-mix(in srgb, var(--steel) 20%,
   * transparent)` calcule `color(srgb 0.596078 0.635294 0.690196 / 0.2)`,
   * c'est-à-dire 152, 162, 176 à deux dixièmes — et sur un fond plat il
   * compose au pixel près, vérifié. Là où des transparences se superposent,
   * la composition passe par un chemin flottant et s'écarte de **un à deux
   * niveaux sur 255** : mesuré à 51 732 pixels d'écart 1 sur la page
   * d'accueil, 27 091 d'écart 2 sur le tableau de bord, contre un plancher de
   * ZÉRO pixel pour la même source reconstruite. C'est invisible, ce n'est pas
   * rien, et l'annoncer « pixel-exact » aurait été une garantie fausse.
   */
  it("n'écrit pas en dur une couleur de la palette sous transparence", () => {
    const palette = valeursPalette();
    const rgb = new Map<string, string>();   // "r,g,b" -> nom
    const exact = new Map<string, string>(); // "r,g,b,a" -> nom
    for (const [val, noms] of palette) {
      const h = /^#([0-9a-f]{6})$/.exec(val);
      if (h) {
        const c = [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16)).join(",");
        if (!rgb.has(c)) rgb.set(c, noms[0]);
      }
      const a = /^rgba\((\d+),(\d+),(\d+),([0-9.]+)\)$/.exec(val);
      if (a) exact.set(`${a[1]},${a[2]},${a[3]},${Number(a[4])}`, noms[0]);
    }

    const fautifs: string[] = [];
    let examines = 0;
    for (const f of fichiers(SRC, [".tsx", ".ts", ".css"])) {
      const rel = relatif(f);
      if (rel in SANS_FEUILLE || rel.endsWith(".test.ts")) continue;
      examines += 1;
      const src = sansCommentaires(readFileSync(f, "utf8"));
      for (const m of src.matchAll(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([0-9.]+)\s*\)/g)) {
        // `base.css` DÉCLARE ces valeurs, et il en EMPLOIE aussi : les deux
        // halos du fond y écrivaient --violet et --ember sous transparence,
        // et l'exemption posée sur le FICHIER les laissait passer. Elle porte
        // donc sur la déclaration d'une propriété personnalisée, et sur elle
        // seule — c'est le seul endroit où une couleur a le droit d'être
        // écrite en clair.
        const debut = src.lastIndexOf("\n", m.index) + 1;
        if (/^\s*--[a-z0-9-]+:/.test(src.slice(debut, m.index))) continue;
        const c = `${m[1]},${m[2]},${m[3]}`;
        const nom = rgb.get(c);
        if (!nom) continue;
        const nomme = exact.get(`${c},${Number(m[4])}`);
        fautifs.push(nomme
          ? `${rel} : ${m[0]} est DÉJÀ --${nomme}`
          : `${rel} : ${m[0]} est --${nom} sous transparence`);
      }
    }
    expect(fautifs).toEqual([]);
    expect(examines).toBeGreaterThan(200); // témoin : un dossier renommé ne rend pas ce test vert
    expect(rgb.size).toBeGreaterThan(8);
    expect(exact.size).toBeGreaterThan(5);
  });

  /**
   * Une variable déclarée que personne ne lit est du code mort, et elle coûte
   * ce que coûte tout code mort ici : on la relit, on se demande si elle sert,
   * on n'ose pas la retirer. C'est le raisonnement de `codeMort.test.ts`,
   * appliqué à la palette plutôt qu'aux fichiers.
   *
   * Elle vaut surtout pour le PONT posé lors de la migration : il existait
   * pour que le code d'avant continue de rendre la bonne couleur, donc il est
   * fait pour disparaître à mesure que ce code passe. Onze de ses treize
   * planches n'avaient plus aucun lecteur.
   *
   * Le recensement lit `src` ET `desktop`, et la coquille de diffusion emploie
   * des replis (`var(--font-heading, sans-serif)`) qui comptent comme des
   * lectures — c'est bien la variable qui est nommée.
   */
  it("ne déclare pas une variable que personne ne lit", () => {
    const declarees = new Map<string, string>();
    for (const f of fichiers(SRC, [".css"])) {
      for (const m of readFileSync(f, "utf8").matchAll(/^[ \t]*--([a-z0-9-]+):/gm)) {
        if (!declarees.has(m[1])) declarees.set(m[1], relatif(f));
      }
    }
    const lues = new Set<string>();
    for (const racine of [SRC, join(process.cwd(), "desktop/src")]) {
      for (const f of fichiers(racine, [".ts", ".tsx", ".css", ".js", ".html"])) {
        const t = readFileSync(f, "utf8");
        for (const m of t.matchAll(/var\(\s*--([a-z0-9-]+)/g)) lues.add(m[1]);
        for (const m of t.matchAll(/variable:\s*"--([a-z0-9-]+)"/g)) lues.add(m[1]);
      }
    }
    const mortes: string[] = [];
    for (const [nom, ou] of declarees) {
      if (!lues.has(nom)) mortes.push(`${ou} : --${nom} n'est lue par personne`);
    }
    expect(mortes).toEqual([]);
    expect(declarees.size).toBeGreaterThan(20); // témoin : le recensement a lu quelque chose
    expect(lues.size).toBeGreaterThan(20);
  });

  /**
   * La coquille Electron se construit SANS le paquet du site : elle ne peut
   * ni importer la palette ni lire `globals.css`. Ce qui ne peut pas
   * s'importer se COMPARE — c'est la règle déjà posée pour les six langues de
   * `desktop/src/langue.js` et pour la table des processus surveillés.
   *
   * La couleur en jeu est celle de ce qu'on DOIT : la pastille peint la dette
   * en `--flame`, et la source de diffusion du site fait de même. Une
   * divergence ne casserait rien et ne se verrait que sur la machine de
   * quelqu'un d'autre, en jeu — c'est-à-dire jamais ici.
   */
  it("peint la dette de la même couleur des deux côtés du pont", () => {
    const palette = valeursPalette();
    const flamme = [...palette.entries()].find(([, noms]) => noms.includes("flame"))?.[0];
    expect(flamme).toBeDefined();

    const overlay = readFileSync(join(process.cwd(), "desktop/src/overlay.html"), "utf8");
    const m = /\.ligne\s+b\.dette\s*\{[^}]*color:\s*([^;}]+)/.exec(overlay);
    expect(m).not.toBeNull();
    expect(m![1].trim().toLowerCase()).toBe(flamme);
  });

  /**
   * L'état sain du dépôt est ZÉRO trouvaille : les fichiers réels ne peuvent
   * donc pas distinguer un tri juste d'un tri aveugle. Il s'éprouve ailleurs.
   */
  it("reconnaît une couleur de la palette, et laisse le reste", () => {
    const palette = valeursPalette();
    const dedans = (s: string) =>
      [...s.matchAll(COULEUR)].filter((m) => palette.has(m[0].toLowerCase().replace(/\s+/g, "")));

    expect(dedans('color: "#ECEFF4"')).toHaveLength(1);
    expect(dedans('color: "#eceff4"')).toHaveLength(1);           // la casse ne sauve pas
    expect(dedans('background: "rgba(255, 180, 84, 0.08)"')).toHaveLength(1); // les espaces non plus
    expect(dedans('color: "#C8AA6E"')).toHaveLength(0);           // l'or d'avant n'est plus la palette
    expect(dedans('color: "#123456"')).toHaveLength(0);
    expect(dedans("var(--bone)")).toHaveLength(0);
  });
});
