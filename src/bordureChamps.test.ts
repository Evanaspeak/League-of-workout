/**
 * La bordure d'un champ ne se laisse pas AFFAIBLIR.
 *
 * Le critère 1.4.11 des WCAG demande 3:1 entre ce qui identifie une commande et
 * ce qui l'entoure. Mesuré au navigateur le 9 septembre, aucune bordure de champ
 * de ce produit ne l'atteint : `.lol-input` rend 1,22:1, les trois écrans qui
 * écrivent leur champ à la main 1,67:1. Et le fond ne rattrape rien — il rend
 * exactement 1:1, parce que le fond d'un champ est `var(--ink)` à 60 % posé sur
 * un fond de page qui EST `--ink`. De l'encre sur de l'encre donne de l'encre.
 *
 * Corriger demande de monter l'opacité à 0,36, ce qui redessine le chrome de
 * tout le produit : `--line` est lu 91 fois et `--line-strong` 46, et
 * `.lol-panel` seul en compte 104. C'est un arbitrage, il est parti dans
 * `docs/questions-ouvertes.md` (question 13) avec ses trois options chiffrées.
 *
 * CE QUE CE GARDE TIENT, et c'est la seule chose qu'on puisse tenir sans
 * arbitrer : la DIRECTION. La ligne 300 du plan demande d'uniformiser les styles
 * en ligne et les classes utilitaires ; le geste évident — passer les trois
 * écrans d'acquisition sur `.lol-input` — ferait tomber leur bordure de 0,18 à
 * 0,08, c'est-à-dire de 1,67:1 à 1,22:1, sur les trois écrans par lesquels tout
 * le monde entre. On peut monter, on ne peut pas descendre.
 *
 * L'outil de mesure, lui, vit dans `scripts/accessibilite.mjs` et ne tourne pas
 * en intégration continue. Ce fichier-ci est ce qui reste quand personne ne
 * lance de campagne.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = join(__dirname, "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");

/** Luminance relative, définition WCAG. */
function luminance([r, g, b]: number[]): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a: number[], b: number[]): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
/** Compose une couleur transparente sur un fond opaque. */
const sur = (rgb: number[], alpha: number, fond: number[]) =>
  rgb.map((c, i) => c * alpha + fond[i] * (1 - alpha));

const base = lire("src/app/styles/base.css");

/** L'opacité déclarée d'un jeton `rgba(...)` de la palette. */
function alphaDe(jeton: string): number {
  const m = base.match(new RegExp(`--${jeton}:\\s*rgba\\(([^)]+)\\)`));
  if (!m) throw new Error(`--${jeton} introuvable dans base.css`);
  const v = m[1].split(",").map((x) => parseFloat(x));
  return v[3];
}
function hexDe(jeton: string): number[] {
  const m = base.match(new RegExp(`--${jeton}:\\s*#([0-9A-Fa-f]{6})`));
  if (!m) throw new Error(`--${jeton} introuvable dans base.css`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
}

/**
 * Les cinq traitements de champ du produit, et le PLANCHER de chacun.
 *
 * Le plancher est ce que le traitement vaut aujourd'hui, pas ce qu'il devrait
 * valoir : ce garde interdit de reculer, il ne prétend pas que l'état actuel
 * soit conforme. Il ne l'est pas, et le commentaire du haut dit de combien.
 */
const TRAITEMENTS: { nom: string; fichier: string; motif: RegExp; plancher: number }[] = [
  {
    nom: "connexion (style en ligne)",
    fichier: "src/components/LoginButtons.tsx",
    motif: /border:\s*"1px solid var\(--([a-z-]+)\)"/,
    plancher: 0.18,
  },
  {
    nom: "inscription (style en ligne)",
    fichier: "src/app/[locale]/beta/page.tsx",
    motif: /border:\s*"1px solid var\(--([a-z-]+)\)"/,
    plancher: 0.18,
  },
  {
    nom: "récupération (style en ligne)",
    fichier: "src/app/[locale]/recuperation/page.tsx",
    motif: /border:\s*"1px solid var\(--([a-z-]+)\)"/,
    plancher: 0.18,
  },
  {
    nom: ".lol-input",
    fichier: "src/app/styles/composants.css",
    motif: /\.lol-input\s*\{[^}]*border:\s*1px solid var\(--([a-z-]+)\)/,
    plancher: 0.08,
  },
  {
    nom: ".lol-select",
    fichier: "src/app/styles/composants.css",
    motif: /\.lol-select\s*\{[^}]*border:\s*1px solid var\(--([a-z-]+)\)/,
    plancher: 0.08,
  },
];

describe("la bordure des champs de saisie", () => {
  const encre = hexDe("ink");

  it("chaque traitement de champ nomme un jeton de la palette", () => {
    // Le témoin : sans lui, un fichier renommé ou un motif devenu aveugle
    // rendrait les contrôles suivants verts en n'examinant aucun champ.
    const trouves = TRAITEMENTS.map((t) => {
      const m = lire(t.fichier).match(t.motif);
      return m ? { ...t, jeton: m[1] } : null;
    });
    expect(trouves.filter(Boolean)).toHaveLength(TRAITEMENTS.length);
  });

  it.each(TRAITEMENTS)("$nom ne descend pas sous son plancher", (t) => {
    const m = lire(t.fichier).match(t.motif);
    expect(m).not.toBeNull();
    const alpha = alphaDe(m![1]);
    // La règle : on peut monter, on ne peut pas descendre. L'échec porte le
    // contraste rendu, sans quoi il faudrait aller le recalculer à la main.
    const rendu = Math.round(contraste(sur(hexDe("bone"), alpha, encre), encre) * 100) / 100;
    expect({ jeton: `--${m![1]}`, alpha, contraste: rendu, tientLePlancher: alpha >= t.plancher })
      .toEqual({ jeton: `--${m![1]}`, alpha, contraste: rendu, tientLePlancher: true });
  });

  it("les opacités du code sont celles que les questions ouvertes annoncent", () => {
    /**
     * Ce contrôle n'INTERDIT PAS la correction — il interdit qu'elle se fasse
     * en SILENCE. La question 13 des questions ouvertes chiffre l'écart avec
     * les opacités d'aujourd'hui ; monter un jeton sans reprendre ce texte
     * laisserait un document qui ment sur l'état du produit, et ce projet paie
     * ce défaut-là en boucle.
     *
     * Un test qui épinglerait « la bordure est encore sous 3:1 » serait pire :
     * il ferait échouer la correction elle-même, comme l'en-tête de cache des
     * ratios l'a fait en août.
     */
    const questions = lire("docs/questions-ouvertes.md");
    const bloc = questions.slice(questions.indexOf("### 13 · "));
    const m = bloc.match(/contre (?:\*\*)?([0-9],[0-9]+)(?:\*\*)? et (?:\*\*)?([0-9],[0-9]+)(?:\*\*)? aujourd'hui/);
    expect(m).not.toBeNull();
    const annoncees = [m![1], m![2]].map((x) => parseFloat(x.replace(",", ".")));
    expect(annoncees).toEqual([alphaDe("line"), alphaDe("line-strong")]);
  });

  it("le fond d'un champ ne peint rien : c'est la MÊME couleur que la page", () => {
    /**
     * C'est ce qui rend la bordure SEULE responsable de l'identification, donc
     * ce qui interdit de se rassurer avec le fond. Mesuré au navigateur : le
     * rapport entre le fond d'un champ et ce qui l'entoure vaut `1:1`.
     *
     * La raison n'est pas l'opacité — elle est que les deux couleurs sont la
     * MÊME : le champ pose `var(--ink)` à 60 %, et `body` pose `var(--ink)`.
     * De l'encre sur de l'encre donne de l'encre, quelle que soit l'opacité.
     * C'est cette coïncidence-là qu'on épingle : le jour où l'une des deux
     * change, le fond se met à peindre quelque chose et la question 13 se
     * repose.
     */
    const composants = lire("src/app/styles/composants.css");
    const champ = composants.match(/\.lol-input\s*\{\s*background:\s*color-mix\(in srgb, var\(--([a-z-]+)\)/);
    const corps = base.match(/body\s*\{[^}]*background-color:\s*var\(--([a-z-]+)\)/);
    expect({ champ: champ?.[1], corps: corps?.[1] }).toEqual({ champ: "ink", corps: "ink" });
  });
});
