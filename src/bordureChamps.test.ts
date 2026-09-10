/**
 * La frontière d'une commande ne se laisse pas AFFAIBLIR.
 *
 * Le critère 1.4.11 des WCAG demande 3:1 entre ce qui identifie une commande et
 * ce qui l'entoure. Mesuré au navigateur le 9 septembre, SIX traitements portent
 * une frontière et **un seul l'atteint** :
 *
 *   .lol-input / .lol-select          1,20:1     64 emplois
 *   sélecteur de langue (en ligne)    1,35:1     19 pages — la barre, partout
 *   champ en ligne (3 écrans)         1,64:1     connexion, inscription, récupération
 *   .lol-btn-blue                     1,64:1      3 emplois
 *   .lol-btn-danger                   1,70:1      2 emplois
 *   .lol-btn                          dégradé    93 emplois — le seul qui PASSE
 *
 * Et le fond ne rattrape rien : 1 à 1,08:1 partout. Le fond d'un champ est
 * `var(--ink)` à 60 % posé sur un fond de page qui EST `--ink` — de l'encre sur
 * de l'encre donne de l'encre.
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
 * 0,08, c'est-à-dire de 1,64:1 à 1,20:1, sur les trois écrans par lesquels tout
 * le monde entre. On peut monter, on ne peut pas descendre.
 *
 * LES BOUTONS y sont entrés le 9 septembre. Ce qui les fait entrer n'est pas une
 * décision de goût mais la règle du critère, mesurée : sur quatre-vingt-douze
 * boutons, AUCUN n'est sans texte visible — donc un bouton sans frontière est
 * identifié par son texte et sort du champ, et un bouton QUI EN A une doit
 * atteindre 3:1. Le bouton plein passe par son dégradé ; les deux fantômes non.
 *
 * L'outil de mesure, lui, vit dans `scripts/accessibilite.mjs` et ne tourne pas
 * en intégration continue. Ce fichier-ci est ce qui reste quand personne ne
 * lance de campagne.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { alphaDe, contraste, hexDe, sur } from "./test/couleurs";

const RACINE = join(__dirname, "..");
const lire = (p: string) => readFileSync(join(RACINE, p), "utf8");
const base = lire("src/app/styles/base.css");

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
  {
    // Le bouton fantôme : sans fond, sa bordure est la SEULE chose qui dise
    // que c'en est un. Mesuré 1,64:1 sur le panneau Riot et l'administration.
    nom: ".lol-btn-blue",
    fichier: "src/app/styles/composants.css",
    motif: /\.lol-btn-blue\s*\{[^}]*border:\s*1px solid var\(--([a-z-]+)\)/,
    plancher: 0.18,
  },
];

/**
 * Les frontières écrites en `color-mix`, qui ne nomment pas un jeton de la
 * palette mais un POURCENTAGE de l'un d'eux. Le plancher porte donc sur ce
 * pourcentage, et la règle est la même : on peut monter, pas descendre.
 */
const MELANGES: { nom: string; fichier: string; motif: RegExp; plancher: number }[] = [
  {
    // Le sélecteur de langue vit dans la barre, donc sur les dix-neuf pages du
    // produit. C'est la frontière la plus VUE, et elle rend 1,35:1.
    nom: "sélecteur de langue",
    fichier: "src/components/LanguageSwitcher.tsx",
    motif: /border:\s*"1px solid color-mix\(in srgb, var\(--[a-z-]+\) (\d+)%/,
    plancher: 18,
  },
  {
    // La déconnexion et l'arrêt de session : le rouge de la palette à 35 %.
    nom: ".lol-btn-danger",
    fichier: "src/app/styles/composants.css",
    motif: /\.lol-btn-danger\s*\{[^}]*border:\s*1px solid color-mix\(in srgb, var\(--[a-z-]+\) (\d+)%/,
    plancher: 35,
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

  it("chaque frontière en color-mix nomme encore son pourcentage", () => {
    // Le témoin, comme au-dessus : un fichier renommé rendrait les contrôles
    // suivants verts en n'examinant aucune frontière.
    const trouves = MELANGES.map((t) => lire(t.fichier).match(t.motif));
    expect(trouves.filter(Boolean)).toHaveLength(MELANGES.length);
  });

  it.each(MELANGES)("$nom ne descend pas sous son plancher", (t) => {
    const m = lire(t.fichier).match(t.motif);
    expect(m).not.toBeNull();
    const pourcent = parseInt(m![1], 10);
    expect({ nom: t.nom, pourcent, tientLePlancher: pourcent >= t.plancher })
      .toEqual({ nom: t.nom, pourcent, tientLePlancher: true });
  });

  it("le bouton PLEIN garde le fond qui le fait passer", () => {
    /**
     * `.lol-btn` est le seul des six traitements à atteindre 3:1, et il le doit
     * à son dégradé opaque — 93 emplois sur 98. Le passer en fond transparent
     * le ferait rejoindre les fantômes, et rien ne le dirait : le bouton reste
     * lisible, c'est sa FRONTIÈRE qui disparaît.
     */
    const composants = lire("src/app/styles/composants.css");
    const bloc = composants.match(/\.lol-btn\s*\{([^}]*)\}/);
    expect(bloc).not.toBeNull();
    expect(bloc![1]).toMatch(/background:\s*linear-gradient\(/);
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
