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
 * - les pages PUBLIQUES d'acquisition (calculateur, téléchargement,
 *   simulateur, connexion, source OBS, signalement) : elles s'adressent à
 *   quelqu'un qui n'a pas de compte, et ce choix-là appartient à la marque.
 *
 * Tout le reste — c'est-à-dire l'application une fois la porte passée —
 * tutoie.
 */

const RACINE = join(process.cwd(), "src/lib/i18n/dictionaries");

/** Ce qui vouvoie, et pourquoi. Une exemption sans raison n'en est pas une. */
const VOUVOIENT: Record<string, string> = {
  "cgu.ts": "document juridique",
  "confidentialite.ts": "document juridique",
  "consentementSante.ts": "consentement santé : la distance est voulue",
  "calculateur.ts": "page publique d'acquisition",
  "telechargement.ts": "page publique d'acquisition",
  "login.ts": "porte d'entrée, avant tout compte",
  "loginButtons.ts": "porte d'entrée, avant tout compte",
  "sourceObs.ts": "lue par le public d'un stream, pas par le compte",
  "signalement.ts": "formulaire ouvert, y compris sans session",
  "layout.ts": "pied de page et mentions, communs aux pages publiques",
};

/**
 * Des clés tolérées une par une, dans des fichiers qui tutoient par ailleurs.
 *
 * L'exemption porte sur la CLÉ et non sur le fichier : posée sur le fichier,
 * elle couvrirait tout le tableau de bord, ce qui est exactement la façon dont
 * une règle se vide de son contenu.
 *
 * Deux raisons distinctes, et elles ne se confondent pas :
 *  - la santé, où la distance est voulue ;
 *  - le « vous » PLURIEL, qui n'est pas un vouvoiement. Aucun motif ne peut
 *    distinguer « vous êtes amis » de « votre compte » : c'est une question de
 *    sens, elle se tranche à la main, une clé à la fois.
 */
const CLES_TOLEREES: Record<string, string> = {
  veilleJour: "mise en garde de santé : la distance est voulue",
  veilleSemaine: "mise en garde de santé : la distance est voulue",
  accepteeAvec: "« vous êtes amis » est un pluriel, pas un vouvoiement",
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
    expect(examines).toBeGreaterThanOrEqual(8);
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

    const sansPagePublique: string[] = [];
    let examinees = 0;
    for (const [fichier, raison] of Object.entries(VOUVOIENT)) {
      if (!raison.includes("page publique")) continue;
      examinees += 1;
      const consommateurs = lecteursDe(fichier.replace(/\.ts$/, ""));
      const noms = consommateurs.map((c) => relative(SRC, c).replace(/\.tsx?$/, "").split("/").pop()!);
      const atteinte = pages.some((page) => {
        if (!estCheminPublic(routeDe(page))) return false;
        if (consommateurs.includes(page)) return true;
        const t = readFileSync(page, "utf8");
        return noms.some((n) => t.includes(n));
      });
      if (!atteinte) sansPagePublique.push(`${fichier} — « ${raison} »`);
    }

    // Sans témoin, une raison reformulée ferait passer le contrôle au vert en
    // n'examinant aucune dispense.
    expect(examinees).toBeGreaterThan(1);
    expect(sansPagePublique).toEqual([]);
  });

  it("n'exempte que des fichiers qui existent encore", () => {
    // Une dispense qui ne désigne plus rien de vivant est du code mort qu'on a
    // fini par admettre : elle vieillit en silence et fait croire à une règle
    // qu'on ne vérifie plus.
    for (const f of Object.keys(VOUVOIENT)) expect(fichiers).toContain(f);
  });
});
