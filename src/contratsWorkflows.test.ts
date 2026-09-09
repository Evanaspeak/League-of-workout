import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { sansCommentaires } from "@/test/sansCommentaires";

/**
 * Ce que les workflows LISENT, et ce que les routes RENDENT.
 *
 * Trois travaux programmés interrogent le produit et prennent une décision sur
 * le CONTENU de sa réponse. Entre les deux, il n'y a que du JSON : ni type, ni
 * import, ni compilateur. Un champ renommé dans une route ne fait échouer ni la
 * construction ni un test, et `jq` rend simplement une chaîne vide.
 *
 * Les deux modes de panne sont connus et tous deux coûteux :
 *
 *  - **la supervision se met à crier sur un site sain.** `.ok` qui ne vaut plus
 *    « true » fait partir l'alerte à chaque passage, et le workflow porte en
 *    commentaire le jour où c'est arrivé pour une autre cause : « un espace de
 *    plus, et le site en parfaite santé déclenchait l'alerte toutes les quinze
 *    minutes ». Une supervision qui crie au loup finit par ne plus être lue ;
 *  - **les envois programmés se taisent sur un canal mort.** Ils lisent `.push`
 *    et `.courriel` pour noter en avertissement qu'une clé manque, et le
 *    journal porte la panne que ça rattrape — un canal muet brûlait la relance
 *    des absents pour un trimestre, en répondant 200. Ces deux lectures portent
 *    un repli `// "?"` : un champ renommé ne casse rien, il fait disparaître
 *    l'avertissement.
 *
 * Ce qui ne peut pas s'importer se COMPARE — la règle est déjà celle du pont
 * Electron, des six langues de la coquille et de la table des processus
 * surveillés.
 */

const RACINE = process.cwd();
const WORKFLOWS = join(RACINE, ".github/workflows");
const API = join(RACINE, "src/app/api");

/**
 * Les champs qu'un workflow va chercher dans une réponse, par `jq`.
 *
 * Trois formes servent dans ce dépôt : `lire "$corps" '.x'`, `jq -r '.x // …'`
 * et `jq -e '.x >= 0'`. On ne retient que ce qui suit immédiatement un point,
 * ce qui écarte les filtres sans champ.
 */
function champsLus(yml: string): string[] {
  const trouves = new Set<string>();
  for (const m of yml.matchAll(/(?:lire\s+"\$[a-z]+"\s+|jq\s+(?:-[a-zA-Z]+\s+)*)'\.([A-Za-z_][A-Za-z0-9_]*)/g)) {
    trouves.add(m[1]);
  }
  return [...trouves].sort();
}

/**
 * Les routes qu'un workflow interroge, chacune avec les champs lus APRÈS son
 * appel.
 *
 * Le découpage n'est pas une élégance : sans lui, on comparerait les champs à
 * l'UNION de tout ce que le workflow appelle, et un champ renommé dans une
 * route resterait couvert par sa voisine. Mesuré — `envoyes` renommé dans
 * `push/programme` passait au vert parce que `mail/hebdo` le rend aussi.
 *
 * Un travail programmé lit ce qu'il vient de demander : les `jq` d'un tronçon
 * appartiennent à la route qui l'ouvre.
 */
function tronçons(yml: string): { route: string; lus: string[] }[] {
  const appels = [...yml.matchAll(/\$(?:SITE|ADRESSE)\/api\/([A-Za-z0-9/_-]+)/g)]
    .map((m) => ({ chemin: join(API, m[1], "route.ts"), debut: m.index! }))
    .filter((a) => existsSync(a.chemin));
  return appels.map((a, i) => ({
    route: a.chemin,
    lus: champsLus(yml.slice(a.debut, appels[i + 1]?.debut ?? yml.length)),
  }));
}

/**
 * Les clés que rend une route.
 *
 * On lit les objets rendus par `NextResponse.json(` plutôt que d'appeler la
 * route : ce qu'on veut savoir est ce qu'elle PROMET, pas ce qu'un jeu de
 * données particulier en fait sortir. Une route a plusieurs sorties — canal
 * absent, canal configuré, refus — et le workflow peut lire dans n'importe
 * laquelle : on en prend l'union.
 *
 * L'étalement (`{ ...corps, cache: true }`) est suivi jusqu'à la constante
 * qu'il nomme, sinon la moitié des champs de la sonde de santé serait
 * invisible.
 *
 * Le source est privé de ses commentaires : ceux de ces routes nomment leurs
 * champs pour les expliquer.
 */
function clesRendues(chemin: string): string[] {
  const src = sansCommentaires(readFileSync(chemin, "utf8"));
  const cles = new Set<string>();

  /** Le littéral d'objet qui commence à `depart`, accolades équilibrées. */
  const bloc = (depart: number): string => {
    let profondeur = 0;
    for (let i = depart; i < src.length; i++) {
      if (src[i] === "{") profondeur++;
      else if (src[i] === "}" && --profondeur === 0) return src.slice(depart, i);
    }
    return "";
  };

  /**
   * Le motif regarde AUTOUR de la clé sans la consommer : écrit
   * `[{,]\s*(nom)\s*[:,]`, il avale la virgule finale, donc deux raccourcis
   * d'objet qui se suivent — `base,` puis `ms,` — se chevauchent et `matchAll`
   * ne rend que le premier. C'est le piège déjà payé sur le recensement du
   * filtrage par compte.
   */
  const ajouter = (texte: string) => {
    for (const m of texte.matchAll(/(?<=[{,])\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?=[:,}])/g)) {
      cles.add(m[1]);
    }
  };

  /** Le littéral d'une constante nommée, où qu'elle soit déclarée. */
  const constante = (nom: string) => {
    const decl = src.indexOf(`const ${nom} = {`);
    return decl >= 0 ? bloc(src.indexOf("{", decl)) : "";
  };

  for (const m of src.matchAll(/NextResponse\.json\(\s*(\{|[A-Za-z_][A-Za-z0-9_]*)/g)) {
    /**
     * Trois formes, et ce que le sabotage en dit exactement.
     *
     * `NextResponse.json({ … })` se lit sur place ; `NextResponse.json(corps,
     * { status })` ne nomme qu'une variable ; et `{ ...cache.corps, … }` étale
     * une constante déclarée ailleurs. La sonde de santé emploie les trois.
     *
     * Mesuré, et il vaut mieux l'écrire que de le supposer : retirer le suivi
     * de la constante nommée ne fait tomber AUCUN test, et retirer le suivi de
     * l'étalement non plus — chacun rattrape à lui seul les champs de la
     * sonde, qui écrit les deux formes dans le même fichier. **Retirer les
     * deux, en revanche, fait tomber deux contrôles** : il ne reste alors
     * qu'une clé, `cache`, et les quatre champs que lit la supervision
     * paraissent manquants.
     *
     * Aucun des deux n'est donc mort, et aucun des deux n'est éprouvé seul :
     * ils couvrent deux formes réelles, et une route qui n'emploierait que
     * l'une d'elles perdrait sa couverture si l'autre partait.
     */
    const texte = m[1] === "{" ? bloc(src.indexOf("{", m.index!)) : constante(m[1]);
    ajouter(texte);
    // `{ ...cache.corps, cache: true }` : on suit la constante étalée, en ne
    // gardant que le dernier segment d'un accès de propriété.
    for (const e of texte.matchAll(/\.\.\.\s*(?:[A-Za-z_][A-Za-z0-9_]*\.)*([A-Za-z_][A-Za-z0-9_]*)/g)) {
      ajouter(constante(e[1]));
    }
  }
  return [...cles].sort();
}

const paires = readdirSync(WORKFLOWS)
  .filter((f) => f.endsWith(".yml"))
  .flatMap((f) =>
    tronçons(readFileSync(join(WORKFLOWS, f), "utf8")).map((t) => ({ workflow: f, ...t })),
  )
  .filter((p) => p.lus.length > 0);

const nomCourt = (p: { workflow: string; route: string }) =>
  `${p.workflow} → /api/${p.route.slice(API.length + 1).replace(/\/route\.tsx?$/, "")}`;

describe("contrats entre les travaux programmés et les routes qu'ils interrogent", () => {
  it("recense les trois contrats qui décident sur le contenu", () => {
    // Sans ce témoin, un dossier renommé ou un motif devenu aveugle rendrait
    // zéro paire — et un tableau vide s'accorde parfaitement avec lui-même.
    expect(paires.map(nomCourt).sort()).toEqual([
      "envois-programmes.yml → /api/mail/hebdo",
      "envois-programmes.yml → /api/push/programme",
      "supervision.yml → /api/sante",
    ]);
  });

  it.each(paires.map((p) => [nomCourt(p), p] as const))(
    "%s : la route rend tout ce que le travail lit",
    (_nom, p) => {
      const rendues = new Set(clesRendues(p.route));
      const manquants = p.lus.filter((c) => !rendues.has(c));
      expect({ manquants, lus: p.lus }).toEqual({ manquants: [], lus: p.lus });
    },
  );

  it.each(paires.map((p) => [nomCourt(p), p] as const))(
    "%s : les deux côtés sont réellement examinés",
    (_nom, p) => {
      expect(p.lus.length).toBeGreaterThanOrEqual(2);
      expect(clesRendues(p.route).length).toBeGreaterThanOrEqual(2);
    },
  );

  /**
   * Les deux moitiés du verdict de la supervision, parce qu'aucune ne suffit
   * seule : un 200 sur une base morte suffirait à la faire taire, un 503 sur
   * un corps sain à la faire crier.
   */
  it("la supervision exige le code HTTP autant que le corps", () => {
    const yml = readFileSync(join(WORKFLOWS, "supervision.yml"), "utf8");
    expect(yml).toMatch(/\[\s*"\$code"\s*=\s*"200"\s*\][^\n]*&&[^\n]*lire\s+"\$corps"\s+'\.ok'/);
  });

  it("la sonde fait varier son code avec l'état de la base", () => {
    const src = sansCommentaires(readFileSync(join(API, "sante/route.ts"), "utf8"));
    expect(src).toMatch(/const statut = [^;]*\b503\b/);
    expect(src).toMatch(/status: (?:cache\.statut|statut)/);
  });
});
