import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sansCommentaires } from "@/test/sansCommentaires";

/**
 * Les outils de mesure lisent leurs arguments de la MÊME façon.
 *
 * Quatre scripts, un drapeau `--langue=xx`, et trois d'entre eux qui lisaient
 * en plus leur adresse par le RANG (`process.argv[2]`). Un drapeau posé avant
 * l'adresse devenait donc l'adresse : `accessibilite.mjs` a rendu « quinze
 * pages injoignables » et `performance.mjs` a chronométré `/fr/fr/dashboard`,
 * qui est un 404. Les deux fois, le rapport avait l'air d'un rapport.
 *
 * Ce que ce garde tient n'est pas une préférence de style : le contrôle
 * d'atterrissage de ces outils NE PEUT PAS voir ce défaut, puisqu'il compare
 * le chemin d'arrivée au chemin transformé, c'est-à-dire à lui-même. Il faut
 * donc l'empêcher à l'écriture.
 */

const SCRIPTS = join(process.cwd(), "scripts");

/**
 * Ce qui est dispensé, avec sa raison.
 *
 * `langue.mjs` PORTE la règle : c'est le seul endroit où `argv` se découpe.
 */
const DISPENSES: Record<string, string> = {
  "langue.mjs": "porte la règle : c'est lui qui écarte les drapeaux",
};

function fichiers(): string[] {
  return readdirSync(SCRIPTS).filter((f) => f.endsWith(".mjs"));
}

/**
 * Les arguments de chaque appel à `nom`, parenthèses ÉQUILIBRÉES.
 *
 * Un `[^)]*` s'arrête à la première parenthèse fermante : sur
 * `enLangue(langueDemandee(process.argv), refuserPrefixe(x))` il ne rend que
 * le premier argument, et le contrôle passe à côté du second — c'est-à-dire
 * du chemin, qui est tout le sujet.
 */
export function argumentsDe(texte: string, nom: string): string[] {
  const out: string[] = [];
  const motif = new RegExp(`\\b${nom}\\(`, "g");
  let m: RegExpExecArray | null;
  while ((m = motif.exec(texte))) {
    let profondeur = 1;
    let i = m.index + m[0].length;
    const debut = i;
    while (i < texte.length && profondeur > 0) {
      if (texte[i] === "(") profondeur++;
      else if (texte[i] === ")") profondeur--;
      i++;
    }
    out.push(texte.slice(debut, i - 1));
  }
  return out;
}

/**
 * L'outil prend-il un chemin de page depuis la ligne de commande ?
 *
 * On suit un SAUT : les identifiants affectés depuis `positionnels`, puis
 * ceux affectés depuis une expression qui en contient un. Si l'un d'eux
 * arrive dans un appel à `enLangue`, le chemin vient de l'extérieur.
 */
export function prendUnCheminEnLigneDeCommande(texte: string): boolean {
  const noms = new Set<string>();
  for (const ligne of texte.split("\n")) {
    if (!/\bpositionnels\b/.test(ligne)) continue;
    for (const m of ligne.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) noms.add(m[1]);
  }
  for (const ligne of texte.split("\n")) {
    if (![...noms].some((n) => ligne.includes(n))) continue;
    const decl = ligne.match(/const\s+([A-Z][A-Z0-9_]{2,})\s*=/);
    if (decl) noms.add(decl[1]);
  }
  for (const args of argumentsDe(texte, "enLangue")) {
    if (/\bpositionnels\b/.test(args)) return true;
    if ([...noms].some((n) => new RegExp(`\\b${n}\\b`).test(args))) return true;
  }
  return false;
}

describe("les outils de mesure lisent leurs arguments de la même façon", () => {
  it("examine tous les scripts, et il y en a", () => {
    // Sans ce témoin, un dossier renommé rendrait les contrôles suivants
    // verts en n'ouvrant aucun fichier.
    expect(fichiers().length).toBeGreaterThanOrEqual(6);
  });

  it("aucun ne lit un argument par son rang sans écarter les drapeaux", () => {
    const fautifs = fichiers()
      .filter((f) => !DISPENSES[f])
      .filter((f) => /process\.argv\s*\[\s*[2-9]/.test(readFileSync(join(SCRIPTS, f), "utf8")));
    expect(fautifs).toEqual([]);
  });

  it("celui qui lit une langue passe par le drapeau commun", () => {
    /**
     * `accessibilite.mjs` la prenait NUE, en troisième position. Quatre outils
     * qui prennent la même chose de deux façons finissent par diverger, et
     * c'est celui qui s'en sert le moins souvent qui garde l'ancienne.
     */
    const fautifs = fichiers()
      .filter((f) => !DISPENSES[f])
      .map((f) => [f, readFileSync(join(SCRIPTS, f), "utf8")] as const)
      .filter(([, texte]) => /langue/i.test(texte) && texte.includes("LANGUES"))
      .filter(([, texte]) => !texte.includes("langueDemandee(process.argv)"))
      .map(([f]) => f);
    expect(fautifs).toEqual([]);
  });

  it("celui qui prend un CHEMIN en ligne de commande refuse un préfixe de langue", () => {
    /**
     * `enLangue` pose le préfixe elle-même, donc `/fr/dashboard` devient
     * `/fr/fr/dashboard` — un 404 sur lequel l'outil rend d'excellents
     * chiffres. Le contrôle d'atterrissage ne peut pas le voir : il compare
     * le chemin d'arrivée au chemin transformé, c'est-à-dire à lui-même.
     *
     * Je suis tombé dedans deux fois, la seconde après l'avoir écrit au
     * journal. Une leçon qu'on écrit sans la fermer se retombe dedans.
     *
     * Le discriminant n'est PAS « emploie `enLangue` » : `accessibilite.mjs`
     * et `comparer-rendu.mjs` l'emploient sur une liste de pages écrite dans
     * le script, où personne ne peut glisser un préfixe. Ce qui distingue,
     * c'est que le chemin vienne de la LIGNE DE COMMANDE — et ça se suit :
     * un identifiant affecté depuis `positionnels`, ou depuis une expression
     * qui en contient un, puis passé à `enLangue`.
     */
    const concernes = fichiers()
      .filter((f) => !DISPENSES[f])
      .map((f) => [f, readFileSync(join(SCRIPTS, f), "utf8")] as const)
      .filter(([, texte]) => prendUnCheminEnLigneDeCommande(texte));
    // Sans ce témoin, un renommage viderait la liste et le contrôle passerait
    // au vert en n'examinant aucun outil.
    expect(concernes.length).toBeGreaterThanOrEqual(2);
    const fautifs = concernes.filter(([, t]) => !t.includes("refuserPrefixe(")).map(([f]) => f);
    expect(fautifs).toEqual([]);
  });

  /**
   * Un préchargement n'est pas un chargement, et l'outil doit les séparer.
   *
   * Le routeur de Next va chercher les routes liées depuis la navigation
   * APRÈS le `load` : sur le tableau de bord, les fragments de `/settings`,
   * `/history` et `/amis` arrivent une seconde plus tard. Comptés dans le
   * poids de la page, ils gonflent le chiffre de plus du double — le journal
   * portait « 453 ko » pour une page qui en charge 228.
   *
   * Et la conséquence est allée plus loin qu'un chiffre : les
   * soixante-treize kilo-octets « apparus en V460 » étaient entièrement du
   * préchargement, né de ce que cette version a rendu cent cinquante pages
   * prérendues — le routeur ne préchargeait pas les routes dynamiques.
   *
   * Le piège est écrit au journal depuis la campagne du 23 août, sur cet
   * outil-là. Ce test le ferme.
   */
  it("performance.mjs distingue ce qui est chargé de ce qui est préchargé", () => {
    /**
     * Le contrôle porte sur le BRANCHEMENT, pas sur la présence des mots.
     *
     * Mon premier jet cherchait « loadEventEnd » et « apresLoad » : poser
     * `apresLoad: false`, ou remplacer l'expression de la frontière par zéro,
     * laisse les deux mots en place — dans le code et dans le commentaire qui
     * l'explique — et les deux sabotages passaient au vert. C'est la troisième
     * fois cette nuit que ce piège se présente, et il est écrit au journal.
     *
     * La source est lue PRIVÉE de ses commentaires, sans quoi le garde se
     * satisferait de sa propre explication.
     */
    const texte = sansCommentaires(readFileSync(join(SCRIPTS, "performance.mjs"), "utf8"));
    // La frontière est l'INSTANT, et elle se COMPARE : une ressource demandée
    // après la fin du `load` n'a pas été chargée par la page.
    /**
     * La frontière doit être DÉRIVÉE de la fin du `load`, et pas seulement
     * mentionnée : `loadEventEnd` figure ailleurs dans ce fichier, pour le
     * temps de chargement affiché. Remplacer l'expression par zéro laissait
     * donc le mot en place et le sabotage passait — quatrième variante du même
     * piège dans la même nuit.
     */
    expect(texte).toMatch(/\bfin\s*=\s*[^;]*loadEventEnd/);
    expect(texte).toMatch(/startTime\s*>\s*\w+/);
    // Et le résultat de cette comparaison doit AIGUILLER vers deux totaux
    // distincts, sinon la distinction est calculée et jamais employée.
    expect(texte).toMatch(/apresLoad\s*\?\s*\w+\s*:\s*\w+/);
    // Enfin les deux se rendent séparément : une distinction qu'on ne dit pas
    // ne sert à personne.
    expect(texte).toMatch(/Préchargé/);
  });

  /**
   * Un clic sur ce que la feuille de style CACHE ne déplie rien, et il coûte.
   *
   * `[aria-expanded="false"]` trouve aussi `.nav-burger` (montrée sous 720 px)
   * et `.rail-bascule` (montrée sous 1180 px). L'audit tourne à 1280 px : les
   * deux y sont `display: none` sur tous les écrans connectés, donc chaque
   * clic expire à son demi-tour d'horloge, trois fois par page.
   *
   * Ce n'est pas qu'une lenteur, et c'est pourquoi ça se garde : le journal
   * porte déjà la fois où le dépliage a fait DÉBORDER l'audit de son quart
   * d'heure — vingt et une pages mesurées, et les dernières passes coupées en
   * route. Un outil qui s'arrête avant la fin ne dit pas qu'il s'est arrêté.
   *
   * Mesuré sur huit pages d'un compte semé à soixante parties : 105 558 ms
   * tous dépliants confondus, 9 176 ms sur les seuls visibles.
   */
  it("accessibilite.mjs ne clique que les dépliants VISIBLES", () => {
    // Privée de ses commentaires : celui qui précède le sélecteur cite le
    // motif fautif pour dire pourquoi il a disparu.
    const texte = sansCommentaires(readFileSync(join(SCRIPTS, "accessibilite.mjs"), "utf8"));
    const selecteurs = [...texte.matchAll(/\[aria-expanded="false"\][^'"`\n]*/g)].map((m) => m[0]);
    // Sans ce témoin, un sélecteur renommé rendrait le contrôle vert en
    // n'examinant rien.
    expect(selecteurs.length).toBeGreaterThanOrEqual(1);
    expect(selecteurs.filter((s) => !s.includes(":visible"))).toEqual([]);
  });

  /**
   * Le fragment se retire UNE fois, dans la liste, pas à chaque passe.
   *
   * Les trois passes de fin mesurent des choses qui ne dépendent pas du
   * fragment, donc elles visitent l'adresse nue. Écrit chez elles, ce retrait
   * faisait charger `/fr/settings` SIX fois de suite à l'identique — la
   * rubrique nue plus ses cinq fragments — dans une page RÉEMPLOYÉE, où le
   * second chargement met huit à trente secondes au lieu d'une seconde deux.
   */
  it("les passes qui visitent l'adresse nue ne la visitent qu'une fois", () => {
    const texte = sansCommentaires(readFileSync(join(SCRIPTS, "accessibilite.mjs"), "utf8"));
    expect(texte).toMatch(/aVisiterNu\s*=\s*\[\s*\.\.\.new Set\(/);
    const passes = (texte.match(/for \(const chemin of aVisiterNu\)/g) ?? []).length;
    expect(passes).toBeGreaterThanOrEqual(3);
    // Et le retrait ne se refait pas au vol : ce serait le remettre.
    expect(texte).not.toMatch(/enLangue\([^)]*\)\.split\("#"\)/);
  });

  /**
   * Un `<text>` SVG ne se peint pas par `color`, et l'audit le jugeait quand
   * même.
   *
   * Son balayage `body *` RETENAIT déjà les `<text>` de recharts — ils ont du
   * texte propre, une boîte, et passent tous les filtres. Ce qu'il lisait
   * dessus était `style.color`, c'est-à-dire la couleur HÉRITÉE du conteneur
   * (`--bone` sur un panneau, 15:1), quelle que soit leur vraie couleur.
   *
   * Ce n'est donc pas « l'audit ne voit pas le SVG » — c'est pire : **il le
   * juge, et il conclut que tout va bien**. Sept graphiques du tableau de
   * bord et les deux courbes des réglages étaient dans ce cas.
   *
   * Le contrôle porte sur le BRANCHEMENT, pas sur la présence du mot : une
   * fonction `teinteDe` parfaitement écrite et jamais appelée laisserait
   * exactement le défaut d'origine.
   */
  it("accessibilite.mjs lit le fill d'un texte SVG, pas son color", () => {
    const texte = sansCommentaires(readFileSync(join(SCRIPTS, "accessibilite.mjs"), "utf8"));
    // La fonction existe, elle distingue le SVG, et elle lit `fill`.
    const bloc = /const teinteDe = \([\s\S]*?\n  \};/.exec(texte);
    expect(bloc).not.toBeNull();
    expect(bloc![0]).toMatch(/ownerSVGElement/);
    expect(bloc![0]).toMatch(/style\.fill\b/);
    // `fill-opacity` est une propriété DISTINCTE d'`opacity` et se multiplie à
    // l'alpha : la sauter ferait juger un texte à demi transparent comme s'il
    // était plein.
    expect(bloc![0]).toMatch(/fillOpacity/);
    // Et elle est BRANCHÉE : c'est elle qui donne la couleur d'avant-plan.
    expect(texte).toMatch(/const brut = teinteDe\(el, style\);/);
    // Le contrôle de contraste ne lit plus `style.color` de son côté.
    expect(texte).not.toMatch(/const \w+ = lire\(style\.color\);\s*\n\s*if \(!/);
    // La couleur RAPPORTÉE est celle qu'on a mesurée : nommer `style.color`
    // sur un `<text>` enverrait corriger un jeton qui n'y est pour rien.
    expect(texte).not.toMatch(/couleur:\s*style\.color/);
  });

  it("accessibilite.mjs compose l'opacité HÉRITÉE avant de juger un contraste", () => {
    const texte = sansCommentaires(readFileSync(join(SCRIPTS, "accessibilite.mjs"), "utf8"));

    /**
     * `opacity` posée sur un conteneur fait pâlir tout ce qu'il contient, et
     * le style calculé du texte rend la couleur PLEINE. L'audit annonçait donc
     * 5,82:1 sur une ligne qui se lit 4,11 à l'écran — pas « il ne voit pas »,
     * mais « il juge, et il conclut que tout va bien ».
     *
     * Le garde porte sur le BRANCHEMENT : une fonction parfaitement écrite et
     * jamais appelée laisserait exactement le défaut d'origine.
     */
    const cumul = /const opaciteHeritee = \(el\) => \{[\s\S]*?\n  \};/.exec(texte);
    expect(cumul).not.toBeNull();
    /**
     * Elle remonte les ANCÊTRES et MULTIPLIE. La CONDITION d'arrêt est
     * épinglée, pas seulement le mot `parentElement` : le sabotage l'a exigé.
     * Ramener la boucle à `n === el` — donc à l'élément seul, qui est le
     * défaut d'origine — laisse `n = n.parentElement` en place dans
     * l'incrément, et un garde qui cherche le mot passe alors au vert.
     *
     * Le prix est qu'un remaniement de la boucle fait tomber le contrôle.
     * C'est le bon sens de l'échec : il dit « viens me remettre à jour » au
     * lieu de se taire le jour où la remontée cesse.
     */
    expect(cumul![0]).toMatch(
      /for \(let n = el; n && n !== document\.documentElement; n = n\.parentElement\)/,
    );
    expect(cumul![0]).toMatch(/cumul \*= o/);
    expect(cumul![0]).toMatch(/\.opacity/);

    // Elle est branchée sur l'alpha de la teinte, et la teinte est COMPOSÉE
    // sur le fond avant que le rapport ne soit calculé.
    expect(texte).toMatch(/const alpha = brut\.a \* opaciteHeritee\(el\);/);
    expect(texte).toMatch(/const avant = \{[\s\S]*?brut\.r \* alpha \+ fond\.r \* \(1 - alpha\)/);
    expect(texte).toMatch(/const r = ratio\(avant, fond\);/);

    /**
     * L'ancien plancher est parti, et c'est la moitié qu'on oublierait.
     *
     * `avant.a < 0.5` écartait le PIRE cas — un texte à quarante pour cent
     * n'était pas mesuré du tout — et jugeait le reste à pleine force. Le
     * remettre rendrait la composition inopérante sur la moitié basse.
     */
    expect(texte).not.toMatch(/avant\.a < 0\.5/);
    // Reste le seul cas sans objet : ce qui est parfaitement invisible.
    expect(texte).toMatch(/if \(alpha <= 0\) continue;/);

    /**
     * Ce qui est INACTIF sort du champ — WCAG 1.4.3 l'exempte — et le motif
     * ne peut PAS contenir `:read-only` : en CSS il désigne tout ce qui n'est
     * pas éditable, donc chaque `div`, donc le produit entier.
     */
    const inactif = /const estInactif = \(el\) =>[\s\S]*?;\n/.exec(texte);
    expect(inactif).not.toBeNull();
    expect(inactif![0]).toMatch(/\[disabled\]/);
    expect(inactif![0]).toMatch(/aria-disabled/);
    expect(inactif![0]).not.toMatch(/:read-only/);
    expect(texte).toMatch(/estInactif\(el\)\) continue;/);

    /**
     * Et la passe principale mesure l'état POSÉ.
     *
     * Sans `reducedMotion`, un fondu en cours devient un constat : la boucle
     * de l'accueil traverse 0,27 et 0,73 à chaque tour, soit une vingtaine de
     * faux constats par exécution — de quoi faire dispenser la règle.
     */
    const principale = /const ctx = await navigateur\.newContext\(\{ viewport[^)]*\)/.exec(texte);
    expect(principale).not.toBeNull();
    expect(principale![0]).toMatch(/reducedMotion: "reduce"/);
  });

  it("la dispense désigne encore un fichier vivant", () => {
    // Une dispense qui ne désigne plus rien est du code mort qu'on a admis.
    const presents = new Set(fichiers());
    expect(Object.keys(DISPENSES).filter((f) => !presents.has(f))).toEqual([]);
  });
});
