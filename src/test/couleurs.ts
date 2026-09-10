/**
 * Ce qu'il faut pour juger un contraste, écrit une seule fois.
 *
 * `bordureChamps.test.ts` portait la luminance, le rapport de contraste, la
 * composition d'une couleur transparente et la lecture de la palette. Le garde
 * du contraste de TEXTE en a besoin des quatre, à l'identique — et une règle
 * écrite deux fois finit avec une version en retard, ce que ce dépôt paie en
 * boucle. C'est le motif déjà appliqué à `sansCommentaires` et à
 * `fichiersLangue` : ce qui sert à deux gardes vit à part.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(__dirname, "..", "..");
const base = readFileSync(join(RACINE, "src/app/styles/base.css"), "utf8");

/** Luminance relative, définition WCAG. */
export function luminance([r, g, b]: number[]): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contraste(a: number[], b: number[]): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

/** Compose une couleur transparente sur un fond opaque. */
export const sur = (rgb: number[], alpha: number, fond: number[]) =>
  rgb.map((c, i) => c * alpha + fond[i] * (1 - alpha));

/** L'opacité déclarée d'un jeton `rgba(...)` de la palette. */
export function alphaDe(jeton: string): number {
  const m = base.match(new RegExp(`--${jeton}:\\s*rgba\\(([^)]+)\\)`));
  if (!m) throw new Error(`--${jeton} introuvable dans base.css`);
  return m[1].split(",").map((x) => parseFloat(x))[3];
}

/**
 * La même lecture, quand le jeton peut être opaque.
 *
 * `alphaDe` LÈVE sur un jeton sans transparence, et c'est ce qu'il faut là où
 * l'appelant sait qu'il en attend une. Le garde du contraste de texte, lui,
 * balaie des jetons dont il ne sait pas d'avance lesquels sont opaques : il
 * lui faut la version qui rend 1. Deux besoins, une seule lecture de la
 * palette — la rouvrir chez l'appelant serait la duplication que ce module
 * existe pour empêcher.
 */
export function alphaOu1(jeton: string): number {
  const m = base.match(new RegExp(`--${jeton}:\\s*rgba\\(([^)]+)\\)`));
  return m ? parseFloat(m[1].split(",")[3]) : 1;
}

/**
 * Les composantes d'un jeton, qu'il soit écrit en `#rrggbb`, en `rgba()` ou
 * en ALIAS d'un autre jeton.
 *
 * Le troisième cas n'est pas théorique : `--gold: var(--amber)` est le pont
 * de la migration de palette, et c'est sous ce nom-là que la correction de
 * dates écrit sa couleur. Ne pas le suivre ferait lever le garde sur un jeton
 * parfaitement déclaré.
 */
export function hexDe(jeton: string, profondeur = 0): number[] {
  if (profondeur > 4) throw new Error(`--${jeton} : chaîne d'alias sans fin`);
  const h = base.match(new RegExp(`--${jeton}:\\s*#([0-9A-Fa-f]{6})`));
  if (h) return [0, 2, 4].map((i) => parseInt(h[1].slice(i, i + 2), 16));
  const r = base.match(new RegExp(`--${jeton}:\\s*rgba?\\(([^)]+)\\)`));
  if (r) return r[1].split(",").slice(0, 3).map((x) => parseFloat(x));
  const a = base.match(new RegExp(`--${jeton}:\\s*var\\(--([a-z-]+)\\)`));
  if (a) return hexDe(a[1], profondeur + 1);
  throw new Error(`--${jeton} introuvable dans base.css`);
}

/** Les composantes d'un littéral `#rrggbb` écrit dans un composant. */
export const litteral = (hex: string) =>
  [0, 2, 4].map((i) => parseInt(hex.replace("#", "").slice(i, i + 2), 16));
