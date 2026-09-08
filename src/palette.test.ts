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
 * **Ce que ce garde ne couvre PAS**, écrit plutôt que laissé à découvrir :
 * `src/lib/graphiques.ts` garde la palette des graphiques en littéraux. Ce
 * n'est pas une contrainte de rendu — mesuré, `var()` se résout parfaitement
 * dans un attribut de présentation SVG — c'est que recharts manipule ces
 * chaînes, et que le passage en `var()` n'a pas été éprouvé. C'est un chantier
 * à part, pas une exemption de confort.
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
    for (const f of fichiers(SRC, [".tsx", ".ts"])) {
      const rel = relatif(f);
      if (rel in SANS_FEUILLE || rel.endsWith(".test.ts")) continue;
      examines += 1;
      for (const m of sansCommentaires(readFileSync(f, "utf8")).matchAll(COULEUR)) {
        const v = m[0].toLowerCase().replace(/\s+/g, "");
        const noms = palette.get(v);
        if (noms) fautifs.push(`${rel} : ${m[0]} vaut --${noms[0]}`);
      }
    }
    expect(fautifs).toEqual([]);
    expect(examines).toBeGreaterThan(200); // témoin : un dossier renommé ne rend pas ce test vert
    expect(palette.size).toBeGreaterThan(8);
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
