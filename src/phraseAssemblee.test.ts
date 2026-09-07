/**
 * Une PHRASE se lit dans le dictionnaire, elle ne s'assemble pas dans le
 * composant.
 *
 * Le dictionnaire des défis le dit en tête depuis longtemps : « chaque défi
 * porte une PHRASE, pas un gabarit à trous ». La règle vaut partout, et elle
 * s'est fait prendre en défaut trois fois — la ligne du niveau de compte, qui
 * rendait « 400 XP 次のレベルまで 5 » en japonais, puis trois libellés de
 * lecteur d'écran de l'écran des amis :
 *
 *     `${t.copier} ${g.nom}`          → « コピー ma-team »
 *     `${t.equipeRelayer} ${pseudo}`  → « 引き受ける Kayn »
 *
 * Le japonais place l'objet AVANT le verbe et l'allemand rejette l'infinitif à
 * la fin : les deux produisent une phrase cassée, et **personne de voyant ne
 * la verra jamais**, puisque les trois vivent dans un `aria-label` ou dans un
 * libellé `lecture-ecran`. C'est exactement le genre de défaut qui reste.
 *
 * Le garde porte sur les GABARITS des `.tsx` : c'est la forme qui compose une
 * phrase. Ce qui reste permis est écrit avec sa raison.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Un accès à un dictionnaire : `${t.x}`, `${tt.x}`, `${tExo.x}`.
 *
 * L'identifiant doit être `t`, `tt`, ou `t` suivi d'une MAJUSCULE. Sans cette
 * borne, `${titrage.variable}` — un nom de variable CSS dans la mise en page
 * racine — passerait pour un libellé, et le garde crierait sur du code qui
 * n'a rien à voir avec du texte.
 */
const LIBELLE = /\$\{\s*t(?:t|[A-Z][A-Za-z]*)?\.[A-Za-z]/;

/**
 * Ce qui reste permis, et pourquoi. Une dispense qui ne désigne plus rien de
 * vivant tombe : c'est la règle des autres gardes de ce projet.
 */
export const TOLERE: Record<string, string> = {
  "components/Paliers.tsx":
    "« Niveau 4 » : les six langues placent le mot avant le nombre — fr Niveau, "
    + "en Level, es Nivel, de Stufe, zh 等级, ja レベル. Il n'y a pas d'ordre à "
    + "choisir, donc pas de phrase à confier au dictionnaire.",
  "app/[locale]/p/[jeton]/page.tsx":
    "Même « Niveau 4 », sur le profil public.",
  "app/[locale]/dashboard/TableauDeBord.tsx":
    "« 20V / 40D » : ce n'est pas une phrase mais un couple nombre-initiale, et "
    + "l'initiale vient déjà du dictionnaire partagé `resultat.ts`, où chaque "
    + "langue a choisi la sienne. Les six placent le nombre en premier.",
};

/** Rend les gabarits d'une source qui mêlent un libellé à autre chose. */
export function phraseAssemblee(source: string): string[] {
  return (source.match(/`[^`]*`/g) ?? []).filter((g) => {
    const l = g.search(LIBELLE);
    if (l === -1) return false;
    // Une autre interpolation, APRÈS le libellé : c'est elle qui fait la phrase.
    const apres = g.slice(l + 1).indexOf("${");
    return apres !== -1;
  });
}

/**
 * La même chose en JSX, que le contrôle des gabarits ne voyait pas.
 *
 * `{t.placementSur} {equipesConsultees}` compose exactement la même phrase que
 * `` `${t.placementSur} ${equipesConsultees}` ``, et le japonais y répondait
 * 「中 20」 là où 中 POSTPOSE : il faut 「20 中」. Le champ de classement d'un
 * battle royale l'affichait ainsi depuis qu'il existe.
 *
 * Deux exclusions, chacune avec sa raison :
 *
 * - une CHAÎNE littérale — `{t.mentions}{" "}<Lien…>` — n'est pas une valeur,
 *   c'est l'espace qu'il faut poser à la main autour d'un lien. Une phrase
 *   coupée par un lien reste une phrase par langue de part et d'autre ;
 * - une expression qui porte SON PROPRE libellé de dictionnaire : chaque
 *   langue garde alors la main sur ses mots des deux côtés, ce qui est
 *   précisément ce qu'on demande.
 */
const LIBELLE_JSX = /\{\s*t(?:t|[A-Z][A-Za-z]*)?\.[A-Za-z][\w.]*\s*\}\s*\{/g;
const LIBELLE_NU = /\bt(?:t|[A-Z][A-Za-z]*)?\.[A-Za-z]/;

/** L'expression JSX qui commence à `debut` (sur son accolade ouvrante). */
function expression(source: string, debut: number): string {
  let profondeur = 0;
  for (let i = debut; i < source.length; i++) {
    if (source[i] === "{") profondeur += 1;
    else if (source[i] === "}") {
      profondeur -= 1;
      if (profondeur === 0) return source.slice(debut, i + 1);
    }
  }
  return source.slice(debut);
}

export function phraseAssembleeJsx(source: string): string[] {
  const fautifs: string[] = [];
  for (const m of source.matchAll(LIBELLE_JSX)) {
    const suivant = expression(source, m.index! + m[0].length - 1);
    const dedans = suivant.slice(1, -1).trim();
    if (/^["'`]/.test(dedans)) continue;      // une chaîne littérale, pas une valeur
    if (LIBELLE_NU.test(dedans)) continue;    // elle porte son propre libellé
    // Une expression qui rend un ÉLÉMENT n'est pas un mot dans le même souffle :
    // c'est un nœud à part, souvent un bloc. C'est le cas de la phrase coupée
    // par un lien, sous une autre forme.
    if (dedans.includes("<")) continue;
    fautifs.push(`${m[0]}${dedans.slice(0, 40)}}`);
  }
  return fautifs;
}

function fichiers(dossier: string, sortie: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) {
      if (e.name === "generated" || e.name === "node_modules") continue;
      fichiers(chemin, sortie);
    } else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

describe("aucun composant n'assemble une phrase", () => {
  const SRC = join(__dirname);
  const sources = fichiers(SRC).map((f) => [f.slice(SRC.length + 1), readFileSync(f, "utf8")] as const);

  it("hors de ce qui est toléré, avec sa raison", () => {
    const fautifs = sources
      .filter(([f]) => !(f in TOLERE))
      .flatMap(([f, s]) => phraseAssemblee(s).map((g) => `${f} : ${g}`));
    expect(fautifs).toEqual([]);
  });

  it("et chaque tolérance désigne encore un fichier qui en a besoin", () => {
    // Une dispense qui ne garde plus rien est du code mort dans le garde même
    // qui existe pour l'attraper.
    const inutiles = Object.keys(TOLERE).filter((f) => {
      const s = sources.find(([n]) => n === f);
      return !s || phraseAssemblee(s[1]).length === 0;
    });
    expect(inutiles).toEqual([]);
  });

  it("le recensement a réellement lu quelque chose", () => {
    expect(sources.length).toBeGreaterThan(40);
    const avecLibelle = sources.flatMap(([, s]) => (s.match(/`[^`]*`/g) ?? []))
      .filter((g) => LIBELLE.test(g));
    expect(avecLibelle.length).toBeGreaterThan(3);
  });

  it("et pas davantage en JSX", () => {
    const fautifs = sources
      .flatMap(([f, src]) => phraseAssembleeJsx(src).map((g) => `${f} : ${g}`));
    expect(fautifs).toEqual([]);
  });

  it("le tri JSX se comporte comme annoncé sur des cas fabriqués", () => {
    // L'état sain est ZÉRO trouvaille : c'est le tri qui s'éprouve, pas ce
    // qu'il ramène. Sans ces cas, un motif devenu aveugle passerait au vert.
    expect(phraseAssembleeJsx("<span>{t.placementSur} {equipes}</span>")).toHaveLength(1);
    expect(phraseAssembleeJsx("{tt.niveau} {n}")).toHaveLength(1);
    expect(phraseAssembleeJsx('{t.mentions}{" "}<Lien href="/cgu" />')).toHaveLength(0);
    expect(phraseAssembleeJsx("{t.titre}{depuis ? ` · ${t.suffixe(depuis)}` : \"\"}")).toHaveLength(0);
    expect(phraseAssembleeJsx("{t.placementSur(nombre(equipes))}")).toHaveLength(0);
    expect(phraseAssembleeJsx("{titrage.variable} {barlow.variable}")).toHaveLength(0);
    expect(phraseAssembleeJsx("{t.reconnexion}\n{code && (<span>x</span>)}")).toHaveLength(0);
  });

  it("le tri se comporte comme annoncé sur des cas fabriqués", () => {
    for (const cas of [
      "`${t.copier} ${g.nom}`",
      "`${tExo.relayer} ${l.pseudo} maintenant`",
      "`${tt.niveau} ${n}`",
    ]) expect(phraseAssemblee(cas)).toHaveLength(1);
    for (const cas of [
      "`${t.copierNomme(g.nom)}`",     // la phrase entière vient du dictionnaire
      "`${t.copier}`",                 // un libellé seul
      "`${g.nom} ${l.pseudo}`",        // deux valeurs, aucun libellé
      "`h-full ${titrage.variable} ${barlow.variable}`", // des variables CSS
      "`rien à voir`",
    ]) expect(phraseAssemblee(cas)).toHaveLength(0);
  });
});
