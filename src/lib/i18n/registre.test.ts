import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { estCheminPublic } from "@/lib/routesPubliques";

/**
 * Le produit TUTOIE, sauf là où il a de bonnes raisons de vouvoyer.
 *
 * La règle existait dans les faits et nulle part ailleurs, donc elle a dérivé :
 * l'écran des réglages disait « Toutes VOS données » sous un titre « TES
 * DONNÉES », le panneau des paliers « Ce que VOUS avez déjà fait » au milieu
 * d'un tableau de bord qui tutoie partout, et les sept étapes des premiers pas
 * vouvoyaient de bout en bout.
 *
 * Ce n'est pas une préférence de style : c'est la voix du produit, et le seul
 * retour d'acquisition qu'on ait jamais eu portait dessus — « ça fait trop
 * IA ». Un texte qui change de registre d'un panneau à l'autre est exactement
 * ce qui donne cette impression.
 *
 * **Trois familles vouvoient, chacune pour sa raison :**
 *
 * - le JURIDIQUE (CGU, politique de confidentialité) : ces textes engagent
 *   l'éditeur, et le vouvoiement y est la convention ;
 * - la SANTÉ (consentement, mises en garde de volume) : on y met de la
 *   distance exprès, c'est un avertissement, pas une conversation ;
 * - les pages PUBLIQUES d'acquisition, jusqu'au 8 septembre : elles
 *   s'adressent à quelqu'un qui n'a pas de compte, et ce choix-là appartenait
 *   à la marque.
 *
 * **La troisième famille n'existe plus, et la mesure disait pourquoi avant que
 * le propriétaire ne tranche.** Le témoin est écrit ici depuis le premier
 * jour : « un choix de marque se prend dans les six langues ; un oubli n'en
 * touche qu'une ». Compté par fichier et par langue, le français était SEUL à
 * vouvoyer dans six d'entre eux :
 *
 * | fichier | français | allemand | espagnol |
 * |---|---|---|---|
 * | `calculateur` | 8 vous | 0 Sie, 10 du | 0 usted, 7 tu |
 * | `telechargement` | 4 vous | 1 Sie, 5 du | 1 usted, 2 tu |
 * | `login` | 4 vous | 1 Sie, 9 du | — |
 * | `loginButtons` | 1 vous | 0 Sie, 3 du | — |
 * | `sourceObs` | 5 vous | 2 Sie, 5 du | 0 usted, 4 tu |
 * | `signalement` | 4 vous | 0 Sie, 4 du | 0 usted, 1 tu |
 *
 * Les deux documents juridiques, eux, sont formels dans les trois langues
 * mesurées — 107 « vous » contre 78 « Sie » et 68 « usted » pour la politique
 * de confidentialité. C'est un choix, et il reste.
 *
 * Tout le reste — c'est-à-dire l'application entière, porte comprise — tutoie.
 */

const RACINE = join(process.cwd(), "src/lib/i18n/dictionaries");

/** Ce qui vouvoie, et pourquoi. Une exemption sans raison n'en est pas une. */
const VOUVOIENT: Record<string, string> = {
  "cgu.ts": "document juridique",
  "confidentialite.ts": "document juridique",
  "consentementSante.ts": "consentement santé : la distance est voulue",
  "layout.ts": "pied de page et mentions, communs aux pages publiques",
};

/**
 * Des clés tolérées une par une, dans des fichiers qui tutoient par ailleurs.
 *
 * L'exemption porte sur la CLÉ et non sur le fichier : posée sur le fichier,
 * elle couvrirait tout le tableau de bord, ce qui est exactement la façon dont
 * une règle se vide de son contenu.
 *
 * Trois raisons distinctes, et elles ne se confondent pas :
 *  - la santé, où la distance est voulue ;
 *  - le « vous » PLURIEL, qui n'est pas un vouvoiement. Aucun motif ne peut
 *    distinguer « vous êtes amis » de « votre compte » : c'est une question de
 *    sens, elle se tranche à la main, une clé à la fois ;
 *  - la CITATION d'un texte qu'on n'a pas écrit. Windows affiche « Windows a
 *    protégé votre ordinateur », et le tutoyer reviendrait à inventer un
 *    message que personne ne verra jamais à l'écran — donc à envoyer chercher
 *    une phrase qui n'existe pas, sur la page qui explique précisément
 *    comment passer cet avertissement.
 */
const CLES_TOLEREES: Record<string, string> = {
  veilleJour: "mise en garde de santé : la distance est voulue",
  veilleSemaine: "mise en garde de santé : la distance est voulue",
  accepteeAvec: "« vous êtes amis » est un pluriel, pas un vouvoiement",
  smartScreenIntro: "cite le message de Windows mot pour mot ; le reformuler enverrait chercher une phrase qui n'existe pas",
};

/**
 * Des clés qui TUTOIENT légitimement dans un fichier qui vouvoie.
 *
 * L'exemption porte sur la clé, jamais sur le fichier : posée sur le fichier,
 * elle rendrait le contrôle vide de sens, ce qui est exactement l'état d'où
 * il sort.
 */
const TUTOIEMENT_TOLERE: Record<string, string> = {
  erreurEnvoi: "message d'erreur technique, pas une phrase de santé : la voix ordinaire de l'application",
};

const VOUS = /\b(vous|votre|vos)\b/i;

/**
 * Le tutoiement français : pronoms, possessifs, et impératifs de deuxième
 * personne du singulier. Les impératifs sont ancrés en début de phrase, où
 * les met une consigne d'interface.
 */
const IMPERATIFS = [
  "Clique", "Lance", "Installe", "Connecte", "Coche", "Choisis", "Ouvre",
  "Télécharge", "Essaie", "Fais", "Regarde", "Tape", "Colle", "Appuie", "Va",
].join("|");
/**
 * Les bornes s'écrivent à la main, et c'est le piège de ce garde.
 *
 * `\b` de JavaScript repose sur `[A-Za-z0-9_]` : une lettre ACCENTUÉE y est un
 * caractère NON-mot, donc une frontière. `\btes\b` trouve donc « tes » dans
 * « ê-tes », et `\bta\b` trouve « ta » dans « bê-ta ». Onze faux positifs au
 * premier jet — « Vous êtes connecté », « Candidater à la bêta » — c'est-à-dire
 * un garde qui accuse du vouvoiement d'être du tutoiement.
 */
const LETTRE = "A-Za-zÀ-ÿ";
const TUTOIE = new RegExp(
  `(?<![${LETTRE}])(?:tu|ton|ta|tes|toi)(?![${LETTRE}])`
  + `|(?<![${LETTRE}])(?:${IMPERATIFS})(?![${LETTRE}])`,
);

function blocFrancais(source: string): string | null {
  // `[\s\S]` plutôt que le drapeau `s` : la cible de compilation du projet est
  // antérieure à ES2018, et `tsc` refuse le drapeau.
  const m = /\n {2}fr: \{([\s\S]*?)\n {2}[a-z]{2}: \{/.exec(source);
  return m ? m[1] : null;
}

describe("le registre du produit", () => {
  const fichiers = readdirSync(RACINE)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("lit bien les dictionnaires", () => {
    // Sans ce témoin, un dossier renommé rendrait le contrôle vert en
    // n'examinant aucun fichier — le défaut que ce projet trouve le plus.
    expect(fichiers.length).toBeGreaterThan(20);
    expect(fichiers.filter((f) => blocFrancais(readFileSync(join(RACINE, f), "utf8"))).length)
      .toBeGreaterThan(20);
  });

  it("tutoie partout, sauf là où le vouvoiement porte sa raison", () => {
    const fautifs: string[] = [];
    for (const f of fichiers) {
      if (VOUVOIENT[f]) continue;
      const bloc = blocFrancais(readFileSync(join(RACINE, f), "utf8"));
      if (!bloc) continue;
      for (const ligne of bloc.split("\n")) {
        if (!VOUS.test(ligne)) continue;
        const cle = /^\s*([A-Za-z0-9_]+)\s*:/.exec(ligne)?.[1] ?? "";
        if (CLES_TOLEREES[cle]) continue;
        fautifs.push(`${f} · ${ligne.trim().slice(0, 90)}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  /**
   * Un fichier qui vouvoie ne tutoie pas AUSSI.
   *
   * La dispense écarte le fichier entier du contrôle précédent : un
   * tutoiement posé dedans y est donc parfaitement invisible. `telechargement.ts`
   * était dans ce cas — « Installez l'application sur votre PC », « Connectez-vous
   * avec votre compte », puis « **Clique** sur Informations complémentaires » sur
   * la même page, dans la même langue.
   *
   * Une page qui mélange les deux registres est exactement ce que ce garde
   * existe pour empêcher ; il ne le voyait pas parce qu'il avait cessé de
   * regarder. Une dispense borne ce qu'on tolère, elle n'éteint pas la règle.
   *
   * Le motif couvre les pronoms ET les impératifs de deuxième personne du
   * singulier, parce que le défaut trouvé était un impératif : les pronoms
   * seuls l'auraient laissé passer, et un garde qui ne voit pas le défaut qu'il
   * raconte ne garde rien. La liste d'impératifs est écrite à la main et elle
   * vieillira — mais son vieillissement ne produit que des SILENCES, jamais de
   * fausse alerte : dans un fichier qui vouvoie, la forme correcte finit par
   * `-ez`.
   */
  it("un fichier qui vouvoie ne tutoie pas aussi", () => {
    let examines = 0;
    const fautifs: string[] = [];
    const toleres = new Set<string>();
    for (const f of Object.keys(VOUVOIENT)) {
      const bloc = blocFrancais(readFileSync(join(RACINE, f), "utf8"));
      if (!bloc) continue;
      examines += 1;
      for (const ligne of bloc.split("\n")) {
        if (!TUTOIE.test(ligne)) continue;
        const cle = /^\s*([A-Za-z0-9_]+)\s*:/.exec(ligne)?.[1] ?? "";
        if (TUTOIEMENT_TOLERE[cle]) { toleres.add(cle); continue; }
        fautifs.push(`${f} · ${ligne.trim().slice(0, 90)}`);
      }
    }
    // Témoin : une liste de dispenses vidée rendrait le contrôle vert en
    // n'examinant aucun fichier.
    expect(examines).toBeGreaterThanOrEqual(3);
    expect(fautifs).toEqual([]);
    // Une tolérance qui ne désigne plus rien de vivant est du code mort dans
    // le garde même qui existe pour l'attraper.
    expect([...toleres].sort()).toEqual(Object.keys(TUTOIEMENT_TOLERE).sort());
  });

  /**
   * Le motif s'éprouve sur des cas fabriqués.
   *
   * L'état sain du dépôt est ZÉRO trouvaille : les fichiers réels ne
   * distinguent donc pas un motif juste d'un motif aveugle.
   */
  it("le motif de tutoiement voit les pronoms et les impératifs", () => {
    expect(TUTOIE.test('    a: "Clique sur « Informations complémentaires »."')).toBe(true);
    expect(TUTOIE.test('    a: "C\u0027est ce qui fixe ton niveau."')).toBe(true);
    expect(TUTOIE.test('    a: "Installe l\u0027application."')).toBe(true);
    // Ce qu'il ne doit PAS attraper, dans un fichier qui vouvoie :
    expect(TUTOIE.test('    a: "Installez l\u0027application sur votre PC Windows."')).toBe(false);
    expect(TUTOIE.test('    a: "Cliquez sur « Informations complémentaires »."')).toBe(false);
    // « ta » et « ton » ne se confondent pas avec le début d'un autre mot.
    expect(TUTOIE.test('    a: "Le total attendu."')).toBe(false);
  });

  /**
   * Une dispense « page publique » qu'aucune page publique n'atteint.
   *
   * `simulateur.ts` était dispensé pour cette raison, et elle était FAUSSE :
   * `SimulateurDette` n'est monté que dans `/settings`, c'est-à-dire derrière
   * la porte. Un panneau entier vouvoyait donc au milieu d'un écran qui tutoie
   * de bout en bout, et le garde le laissait passer parce qu'il lisait la
   * raison sans la vérifier.
   *
   * C'est le pire genre de dispense : elle a l'air motivée. Une exemption dont
   * la raison est fausse ne se distingue pas d'une exemption juste tant que
   * personne ne va voir — et c'est justement ce qu'une exemption dispense de
   * faire.
   *
   * Le chemin se suit sur UN saut, comme le garde du nom publié : le
   * dictionnaire est lu par des composants, les composants sont montés par des
   * pages, et la page dit si elle est publique.
   */
  it("une dispense « page publique » désigne une page réellement publique", () => {
    const SRC = join(process.cwd(), "src");
    const APP = join(SRC, "app");

    function fichiersSource(dossier: string, out: string[] = []): string[] {
      for (const e of readdirSync(dossier, { withFileTypes: true })) {
        if (e.name.startsWith(".") || e.name === "node_modules") continue;
        const c = join(dossier, e.name);
        if (e.isDirectory()) fichiersSource(c, out);
        else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$/.test(e.name)) out.push(c);
      }
      return out;
    }
    const tous = fichiersSource(SRC);

    /** Les fichiers qui importent ce dictionnaire. */
    const lecteursDe = (module: string) =>
      tous.filter((f) => readFileSync(f, "utf8").includes(`i18n/dictionaries/${module}"`));

    /** Le chemin de route d'une page, sans le segment de langue ni les groupes. */
    const routeDe = (page: string) =>
      "/" +
      relative(APP, page)
        .replace(/\/page\.tsx?$/, "")
        .split("/")
        .filter((seg) => seg !== "[locale]" && !/^\(.*\)$/.test(seg))
        .join("/");

    const pages = tous.filter((f) => /\/page\.tsx?$/.test(f));
    expect(pages.length).toBeGreaterThan(10);

    /** Ce dictionnaire est-il lu par une page réellement publique ? */
    const atteintParUnePagePublique = (fichier: string) => {
      const consommateurs = lecteursDe(fichier.replace(/\.ts$/, ""));
      const noms = consommateurs.map((c) => relative(SRC, c).replace(/\.tsx?$/, "").split("/").pop()!);
      return pages.some((page) => {
        if (!estCheminPublic(routeDe(page))) return false;
        if (consommateurs.includes(page)) return true;
        const t = readFileSync(page, "utf8");
        return noms.some((n) => t.includes(n));
      });
    };

    /**
     * La résolution s'éprouve sur des cas RÉELS choisis, pas sur la liste de
     * dispenses — qui n'en contient plus aucune de cette forme depuis que le
     * propriétaire a tranché « tutoie partout ». Sans ça, ce contrôle
     * passerait au vert en n'examinant rien, et il resterait vert le jour où
     * quelqu'un reposerait une dispense « page publique » sans fondement.
     *
     * `calculateur.ts` est lu par une page publique et le reste ; `amis.ts`
     * vit derrière la porte. Le premier doit répondre oui, le second non,
     * sinon la fonction ne trie pas.
     */
    expect(atteintParUnePagePublique("calculateur.ts")).toBe(true);
    expect(atteintParUnePagePublique("amis.ts")).toBe(false);

    const sansPagePublique = Object.entries(VOUVOIENT)
      .filter(([, raison]) => raison.includes("page publique"))
      .filter(([fichier]) => !atteintParUnePagePublique(fichier))
      .map(([fichier, raison]) => `${fichier} — « ${raison} »`);
    expect(sansPagePublique).toEqual([]);
  });

  it("n'exempte que des fichiers qui existent encore", () => {
    // Une dispense qui ne désigne plus rien de vivant est du code mort qu'on a
    // fini par admettre : elle vieillit en silence et fait croire à une règle
    // qu'on ne vérifie plus.
    for (const f of Object.keys(VOUVOIENT)) expect(fichiers).toContain(f);
  });
});
