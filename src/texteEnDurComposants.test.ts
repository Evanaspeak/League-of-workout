import fs from "node:fs";
import path from "node:path";

/**
 * « Aucun texte dans un composant » est la règle numéro un du projet, et rien
 * ne la tenait.
 *
 * `langueEnDur.test.ts` refuse qu'un composant COMPARE `locale` à une langue —
 * c'est le raccourci qui avait laissé un écran en anglais pour quatre langues.
 * Il ne dit rien d'une phrase française écrite directement dans le JSX, qui est
 * la façon la plus simple d'arriver au même résultat.
 *
 * Le même garde, posé sur la coquille Electron la même nuit, y a trouvé cinq
 * textes vivants. Ici il ne trouve rien : la discipline tient. C'est
 * exactement le moment de la figer.
 *
 * Ce qui est cherché : une chaîne littérale contenant une lettre accentuée
 * française. C'est grossier, et c'est ce qui le rend utile — une phrase
 * française sans accent existe, mais elle est rare, et le coût d'un contrôle
 * plus fin serait de ne plus rien attraper du tout.
 */

/**
 * Les deux dossiers, et le second est arrivé après coup.
 *
 * Le garde ne lisait que `src/components`. `src/app` en était dispensé sans
 * que rien ne le dise — et c'est là que le défaut vivait : les deux pages du
 * calculateur affichaient leur titre en français dans les six langues, alors
 * que les traductions existaient depuis le premier jour. Une page est un
 * composant comme un autre ; ce qui la distingue, c'est qu'elle est rendue au
 * serveur, donc qu'elle ne peut pas employer `useT` — et c'est précisément ce
 * qui pousse à écrire le texte en dur.
 *
 * Trouvé en mesurant, pas en relisant : le rapport de performance nomme le
 * plus grand élément de la page, et il l'a nommé en français sur une page
 * allemande.
 */
const DOSSIERS = [
  path.join(process.cwd(), "src", "components"),
  path.join(process.cwd(), "src", "app"),
];

/**
 * Une seule exemption, avec sa raison.
 *
 * Il y en avait deux : la seconde annonçait, dans quatre langues, que les
 * documents juridiques n'existaient qu'en français et en anglais. Ils existent
 * maintenant dans les six, et le bandeau est parti avec elle. Une exemption
 * qu'on peut retirer est le signe que le produit a rattrapé son retard.
 */
const EXEMPTS = new Set([
  // Les noms de langue s'écrivent dans leur propre langue : « Français » n'est
  // pas du français imposé, c'est le nom du choix qu'on propose.
  "LanguageSwitcher.tsx",
  // Une route d'API, pas un écran. Ses messages se traduisent à l'affichage,
  // et `apiErrorsComplets.test.ts` en tient le recensement.
  "route.tsx",
]);

/** Le texte d'un fichier, commentaires retirés. */
function sansCommentaires(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .map((l) => l.replace(/\s\/\/.*$/, ""))
    .join("\n");
}

function fichiers(dossier: string): string[] {
  const trouves: string[] = [];
  for (const e of fs.readdirSync(dossier, { withFileTypes: true })) {
    const complet = path.join(dossier, e.name);
    if (e.isDirectory()) trouves.push(...fichiers(complet));
    else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) trouves.push(complet);
  }
  return trouves;
}

/**
 * Les phrases françaises d'un fichier, quelle que soit la forme qu'elles
 * prennent : chaîne double, chaîne simple, GABARIT, ou texte JSX nu.
 *
 * Elle vit hors de la boucle pour être ÉPROUVÉE. Les fichiers réels n'en
 * contiennent aucune — c'est tout l'objet du garde — donc ils ne distinguent
 * pas ces quatre motifs d'un motif cassé : blinder celui des gabarits laissait
 * le test au vert avec le défaut remis, et c'est exactement comme ça que le
 * trou avait survécu.
 */
export function phrasesFrancaises(source: string): string[] {
  const texte = sansCommentaires(source)
    // Un message d'erreur interne n'est jamais montré : il finit dans un
    // `catch` qui affiche autre chose. Le traduire n'ajouterait rien.
    .replace(/new Error\([^)]*\)/g, "");
  const trouves: string[] = [];
  for (const m of texte.matchAll(/"([^"\n]*[éèêàçûôîïœ][^"\n]*)"/g)) trouves.push(m[1]);
  for (const m of texte.matchAll(/'([^'\n]*[éèêàçûôîïœ][^'\n]*)'/g)) trouves.push(m[1]);
  /**
   * Les GABARITS, entre accents graves.
   *
   * C'était le trou du garde, et ce n'est pas un détail de motif : un gabarit
   * est précisément l'endroit où l'on écrit une phrase qui porte une valeur,
   * donc l'endroit où l'on écrit une phrase. Deux textes vivants s'y
   * cachaient — la ligne de la pastille après une partie d'Apex, et l'écran de
   * départ de la connexion depuis l'application Windows, c'est-à-dire le
   * PREMIER écran de l'application installée. Les deux étaient couverts par une
   * correction déjà faite ailleurs : `enJeu` existe depuis qu'on a traduit la
   * pastille, et personne n'avait repris cette ligne-là.
   */
  for (const m of texte.matchAll(/`([^`\n]*[éèêàçûôîïœ][^`\n]*)`/g)) trouves.push(m[1]);
  /**
   * Le texte JSX NU, qui n'est entouré d'aucun guillemet.
   *
   * C'est la forme qu'avaient les deux titres du calculateur, et les motifs
   * précédents ne la voient pas : ils ne cherchent que des littéraux. Une ligne
   * de texte JSX ne porte ni balise, ni accolade, ni guillemet, ni signe
   * d'affectation. C'est grossier, comme le reste de ce fichier, et c'est ce
   * qui le rend applicable.
   */
  for (const ligne of texte.split("\n")) {
    const nu = ligne.trim();
    if (!/[éèêàçûôîïœÉÈÊÀÇÛÔÎÏŒ]/.test(nu)) continue;
    if (/[<>{}"'`=]/.test(nu)) continue;
    trouves.push(nu);
  }
  return trouves;
}

describe("aucun texte français en dur dans un composant", () => {
  const tous = DOSSIERS.flatMap(fichiers);

  it("lit bien des composants ET des pages", () => {
    // Sans ce contrôle, un dossier renommé rendrait le test vert sur zéro
    // fichier lu — la forme d'erreur qu'on cherche précisément à éviter. Le
    // second compte séparément : c'est celui qui vient d'être ajouté, et il
    // pourrait disparaître sans que le premier s'en aperçoive.
    expect(tous.length).toBeGreaterThan(60);
    expect(tous.filter((f) => f.includes(`${path.sep}app${path.sep}`)).length)
      .toBeGreaterThan(20);
  });

  it("reconnaît les quatre formes qu'une phrase peut prendre", () => {
    // Éprouvé sur des cas FABRIQUÉS, parce que les fichiers réels n'en
    // contiennent aucun : sans ça, un motif blindé rend le garde muet sans
    // qu'aucun contrôle ne bouge. Vérifié en le sabotant — le motif des
    // gabarits neutralisé et le défaut remis, tout restait vert.
    expect(phrasesFrancaises('const a = "déjà fait";')).toContain("déjà fait");
    expect(phrasesFrancaises("const a = 'déjà fait';")).toContain("déjà fait");
    expect(phrasesFrancaises("const a = `${n} élim`;")).toContain("${n} élim");
    expect(phrasesFrancaises("  Combien de pompes après une défaite")).toContain(
      "Combien de pompes après une défaite",
    );
    // Et ce qu'elle laisse passer, volontairement : un commentaire, et une
    // erreur interne que personne ne lit.
    expect(phrasesFrancaises("// une défaite coûte cher")).toEqual([]);
    expect(phrasesFrancaises('throw new Error("réponse illisible");')).toEqual([]);
  });

  it("n'en trouve aucun", () => {
    const fautifs: string[] = [];
    for (const complet of tous) {
      const nom = path.basename(complet);
      if (EXEMPTS.has(nom)) continue;
      for (const p of phrasesFrancaises(fs.readFileSync(complet, "utf8"))) {
        fautifs.push(`${nom} : ${p}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("chaque exemption désigne un fichier qui existe encore", () => {
    // Une exemption qui survit au fichier qu'elle couvrait finit par en couvrir
    // un autre, portant le même nom et rien à voir.
    for (const nom of EXEMPTS) {
      expect({ nom, existe: tous.some((f) => path.basename(f) === nom) })
        .toEqual({ nom, existe: true });
    }
  });
});
