/**
 * Un message qu'on annonce doit se LIRE.
 *
 * V583 a posé `role="alert"` et `role="status"` sur dix-sept messages qui
 * n'étaient annoncés à personne. Reste l'autre moitié du même sujet, et elle
 * n'avait jamais été mesurée : leur CONTRASTE. L'audit d'accessibilité ne
 * pouvait pas le dire — il ne TAPE nulle part, donc aucun refus n'apparaît
 * jamais pendant qu'il regarde. C'est la limite écrite au journal pour le menu
 * déroulant des champions, et elle vaut pour tout ce qui ne paraît qu'après
 * une action.
 *
 * MESURÉ AU NAVIGATEUR le 10 septembre, sur les trois portes — les seules
 * surfaces qu'une sonde peut atteindre sans compte :
 *
 *   /beta         « Ce pseudo est déjà pris »   5,81:1  (14 px)
 *   /recuperation « Une erreur est survenue »   5,81:1  (14 px)
 *   /login        « Pseudo ou code incorrect »  5,20:1  (13,12 px)
 *
 * Et deux valeurs de fond relevées au passage, dont ce garde se sert :
 * le fond de page rend `rgb(12, 14, 17)` et un `.lol-panel` `rgb(20, 23, 28)`.
 *
 * CE QUE CE GARDE TIENT. Les soixante-cinq éléments annoncés du produit
 * emploient neuf traitements de couleur, et statiquement on ne sait pas
 * toujours sur quel fond ils se posent — un message peut vivre sur la page ou
 * dans un panneau. Chacun est donc éprouvé sur les DEUX, et c'est le pire des
 * deux qui compte. Un traitement qui passe partout passe.
 *
 * Ce n'est pas une conformité prouvée : c'est une DIRECTION, comme
 * `bordureChamps.test.ts` la tient pour le critère 1.4.11. Le jour où
 * quelqu'un monte l'opacité de `--faint` ou remplace `--loss` par un rouge
 * plus sombre, le test tombe — et rien d'autre ne le dirait, puisque ces
 * messages ne paraissent qu'au moment d'un refus.
 *
 * CE QU'IL NE FAIT PAS, écrit plutôt que laissé à croire : il ne connaît pas
 * la TAILLE du texte, donc il applique le seuil du texte ordinaire (4,5:1) à
 * tout le monde. C'est le bon sens de l'erreur — le seuil du grand texte est
 * plus bas, donc l'exiger partout ne peut pas laisser passer un défaut.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { alphaOu1, contraste, hexDe, litteral, sur } from "./test/couleurs";
import { sansCommentaires } from "./test/sansCommentaires";

const RACINE = join(__dirname, "..");

/** Le seuil du texte ordinaire. Voir « CE QU'IL NE FAIT PAS ». */
const SEUIL = 4.5;

/** Les deux fonds sur lesquels un message se pose, mesurés au navigateur. */
const FONDS: Record<string, number[]> = {
  page: hexDe("ink"),
  panneau: hexDe("carbon"),
};

/**
 * Les traitements de couleur des éléments annoncés, indexés par l'EXPRESSION
 * telle qu'elle est écrite dans le code.
 *
 * La clé n'est pas décorative : c'est elle que le recensement compare. Une
 * liste indexée par un nom lisible se serait tue le jour où quelqu'un retire
 * `--loss` — c'est exactement le sabotage qui est passé au vert à la première
 * série, et c'est ce qui a fait dériver ce recensement du code au lieu de le
 * déclarer à la main.
 *
 * `voile` est le calque posé SOUS le texte, en pourcentage d'un jeton : c'est
 * la forme `color-mix` des trois portes.
 */
const TRAITEMENTS: Record<string, { quoi: string; voile?: [string, number] }> = {
  "var(--loss)": { quoi: "le rouge de refus, trente-six emplois" },
  "var(--ember)": { quoi: "deux panneaux d'administration" },
  "var(--win)": { quoi: "les messages de succès" },
  "var(--victory)": { quoi: "la même valeur que --win, sous son autre nom" },
  "var(--gold)": { quoi: "la correction de dates ; alias de --amber" },
  "var(--steel)": { quoi: "deux messages de liste vide" },
  "var(--muted)": { quoi: "le réglage des notifications" },
  "var(--signal)": { quoi: "le succès du rattachement Riot" },
  // Le rouge inventé de la saisie de champion. La palette n'a pas de jeton
  // d'ERREUR — `--loss` veut dire « la partie est perdue » — et c'est une
  // question ouverte, pas un oubli. Son contraste, lui, se mesure.
  "#e05555": { quoi: "le refus de la saisie de champion" },
  /**
   * Les trois suivants ne sont écrits sur AUCUNE balise annoncée, et ils
   * comptent quand même.
   *
   * `--bone` est la couleur héritée : les sept balises que le recensement ne
   * résout pas la reçoivent de leur parent, et l'une d'elles — le bandeau de
   * mise à jour de l'application — l'écrit sur son enfant. `--faint` est la
   * ligne d'aide qui accompagne un refus, et c'est le pire rapport du lot.
   * Les deux voiles, eux, sont les fonds des trois portes.
   */
  "var(--bone)": { quoi: "ce que les balises non résolues héritent" },
  "var(--faint)": { quoi: "les lignes d'aide voisines d'un refus" },
  "var(--loss) sur voile 8 %": { quoi: "/beta et /recuperation", voile: ["loss", 0.08] },
  "var(--loss) sur voile 10 %": { quoi: "/login", voile: ["loss", 0.1] },
};

/** Le jeton — ou le littéral — que porte une clé de la table. */
const jetonDe = (cle: string) => cle.replace(/ sur voile.*$/, "");

function rapport(cle: string, fond: number[]): number {
  const t = TRAITEMENTS[cle];
  const voile = t?.voile ? sur(hexDe(t.voile[0]), t.voile[1], fond) : fond;
  const expr = jetonDe(cle);
  if (expr.startsWith("#")) return contraste(litteral(expr), voile);
  const jeton = expr.replace(/^var\(--|\)$/g, "");
  return contraste(sur(hexDe(jeton), alphaOu1(jeton), voile), voile);
}

/** Les `.tsx` de `src`. */
function fichiersTsx(dossier: string): string[] {
  return readdirSync(dossier).flatMap((e) => {
    const p = join(dossier, e);
    return statSync(p).isDirectory() ? fichiersTsx(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

/** Toutes les feuilles de style, pour résoudre une classe en couleur. */
const CSS = readdirSync(join(RACINE, "src/app/styles"))
  .filter((f) => f.endsWith(".css"))
  .map((f) => readFileSync(join(RACINE, "src/app/styles", f), "utf8"))
  .join("\n");

/** La couleur qu'une classe utilitaire pose, si elle en pose une. */
function couleurDeClasse(classe: string): string | null {
  const m = CSS.match(
    new RegExp(`\\.${classe}\\s*\\{[^}]*?color:\\s*(var\\(--[a-z-]+\\)|#[0-9a-fA-F]{6})`));
  return m ? m[1] : null;
}

type Annonce = { fichier: string; balise: string; couleurs: string[] };

/**
 * Ce que chaque élément annoncé emploie comme couleur de TEXTE.
 *
 * Deux chemins, et il faut les deux : la couleur écrite en ligne sur la
 * balise, et celle qu'une classe utilitaire lui pose — `loss-text` est la
 * forme la plus fréquente du produit, et un recensement qui ne lirait que le
 * style en ligne en manquerait vingt sur soixante.
 *
 * La fenêtre est la BALISE, pas le bloc : c'est la seule portée où une
 * couleur s'applique au texte annoncé lui-même. Un `background` de conteneur
 * y entre aussi, d'où l'ancrage sur `color:`.
 */
export function annonces(source: string, fichier = "?"): Annonce[] {
  const s = sansCommentaires(source);
  const out: Annonce[] = [];
  for (const m of s.matchAll(/role="(?:alert|status)"/g)) {
    const debut = s.lastIndexOf("<", m.index!);
    const fin = s.indexOf(">", m.index! + m[0].length);
    if (debut < 0 || fin < 0) continue;
    const balise = s.slice(debut, fin + 1);
    const couleurs = new Set<string>();
    // Le style en ligne, ternaire compris : les deux branches comptent.
    for (const d of balise.matchAll(/\bcolor:\s*([^,}]+)/g))
      for (const c of d[1].match(/var\(--[a-z-]+\)|#[0-9a-fA-F]{6}/g) ?? []) couleurs.add(c);
    const cl = balise.match(/className=(?:"([^"]*)"|\{`([^`]*)`\})/);
    if (cl)
      for (const c of cl[0].match(/[\w-]+/g) ?? []) {
        const v = couleurDeClasse(c);
        if (v) couleurs.add(v);
      }
    out.push({ fichier, balise, couleurs: [...couleurs] });
  }
  return out;
}

const ANNONCES = fichiersTsx(join(RACINE, "src")).flatMap((f) =>
  annonces(readFileSync(f, "utf8"), f.slice(RACINE.length + 1)));

describe("un message annoncé se lit", () => {
  it("chaque traitement atteint le seuil sur les deux fonds", () => {
    const sous = Object.entries(TRAITEMENTS).flatMap(([cle, t]) =>
      Object.entries(FONDS)
        .map(([nom, fond]) => ({ cle, quoi: t.quoi, fond: nom, r: rapport(cle, fond) }))
        .filter((m) => m.r < SEUIL)
        .map((m) => `${m.cle} (${m.quoi}) sur ${m.fond} : ${m.r.toFixed(2)}:1`));
    expect(sous).toEqual([]);
  });

  it("toute couleur RÉELLEMENT employée par un élément annoncé est jugée", () => {
    /**
     * Le contrôle qui rend la liste vérifiée au lieu de déclarée.
     *
     * Sans lui, retirer `--loss` de la table laissait les onze autres et le
     * témoin de longueur au vert — c'est-à-dire que le garde cessait de
     * couvrir le rouge de trente-six éléments sans que rien ne le dise. Le
     * sabotage l'a montré, et c'est lui qui a fait dériver ce recensement du
     * code plutôt que de le tenir à la main.
     *
     * Il attrape aussi l'autre sens : une couleur NOUVELLE posée demain sur
     * un message annoncé doit venir se faire mesurer ici.
     */
    const inconnues = [...new Set(ANNONCES.flatMap((a) => a.couleurs))]
      .filter((c) => !(c in TRAITEMENTS))
      .sort();
    expect(inconnues).toEqual([]);
  });

  it("les trois portes valent ce que le navigateur a mesuré", () => {
    /**
     * Le calcul doit RETROUVER la mesure, sinon il ne mesure pas la même
     * chose qu'elle. Écrit avant d'avoir vu le résultat : j'avais calculé
     * `--faint` à 4,42:1 à la main quand le navigateur en rend 4,72, et c'est
     * la mesure qui avait raison.
     */
    expect(rapport("var(--loss) sur voile 8 %", FONDS.page)).toBeCloseTo(5.81, 2);
    // `/login` mesure 5,20 et non 5,67 : sa carte est un PANNEAU, pas le fond
    // de page. C'est le modèle qui l'a dit — les deux autres portes tombent
    // sur le fond de page au centième près, celle-ci sur l'autre.
    expect(rapport("var(--loss) sur voile 10 %", FONDS.panneau)).toBeCloseTo(5.20, 2);
  });

  it("le recensement porte sur quelque chose, et il RÉSOUT", () => {
    // Un dossier renommé rendrait les contrôles verts sur zéro élément.
    expect(ANNONCES.length).toBeGreaterThanOrEqual(50);
    /**
     * Et le témoin de la RÉSOLUTION, distinct de celui du recensement : un
     * extracteur de couleurs devenu aveugle laisserait le contrôle ci-dessus
     * vert sur zéro couleur inconnue, en n'ayant rien comparé.
     *
     * Les deux chemins comptent séparément — le style en ligne et la classe
     * utilitaire — parce qu'ils se cassent séparément, et que celui des
     * classes couvre à lui seul le tiers des balises.
     */
    const parClasse = ANNONCES.filter((a) => /className/.test(a.balise) && a.couleurs.length);
    const enLigne = ANNONCES.filter((a) => /\bcolor:/.test(a.balise) && a.couleurs.length);
    expect(parClasse.length).toBeGreaterThanOrEqual(15);
    expect(enLigne.length).toBeGreaterThanOrEqual(15);
  });

  it("les balises que le recensement ne résout PAS restent rares et nommées", () => {
    /**
     * La limite, écrite plutôt que laissée à croire.
     *
     * Sept balises n'ont aucune couleur qu'on puisse lire statiquement :
     * deux `lecture-ecran` (hors écran par construction, donc sans contraste
     * à juger), quatre qui HÉRITENT de leur parent, et le bandeau de mise à
     * jour de l'application, dont la couleur vit sur son enfant. Les cinq
     * dernières reçoivent `--bone`, qui est dans la table.
     *
     * Le compte est BORNÉ : si cette famille grossit, ce n'est plus une
     * poignée de cas hérités, c'est un extracteur qui a cessé de voir.
     */
    const muettes = ANNONCES.filter((a) => a.couleurs.length === 0);
    expect(muettes.length).toBeLessThanOrEqual(10);
  });

  it("le calcul distingue vraiment un traitement illisible", () => {
    // Sans ce cas, un rapport qui rendrait toujours dix passerait le premier
    // contrôle en ne prouvant rien. `--ink` sur `--ink`, c'est 1:1.
    expect(rapport("var(--ink)", FONDS.page)).toBeCloseTo(1, 2);
  });
});
