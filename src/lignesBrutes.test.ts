import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Une ligne de base qui traverse le réseau NOMME ses colonnes.
 *
 * C'est la discipline du projet depuis longtemps, et elle a déjà été payée
 * trois fois : `NextResponse.json(games)` publiait huit colonnes que personne
 * ne lit, `{ lien: l.id, ...autre(l) }` aurait publié le pseudo Riot de tout
 * le monde le jour où le `select` s'est élargi, et `PUT /api/user` rendait
 * l'empreinte du mot de passe — **soixante champs mesurés**, dont le jeton de
 * diffusion, le code de parrainage et l'identifiant du parrain, au navigateur
 * de la personne donc dans son cache et dans son onglet réseau. Chaque fois
 * la correction a porté sur SA route ; rien ne disait ce qu'il fallait faire
 * de la suivante.
 *
 * Et le garde des COLONNES ne pouvait pas le voir : il éprouve la fonction
 * `comptePublic`, pas ses appelants. C'est le trou que ce projet paie en
 * boucle, et celui-ci le ferme du côté des routes.
 *
 * Ce garde regarde donc le DOSSIER. Il tient une règle simple et mécanique :
 * une lecture qui ne porte ni `select` ni `omit` rend une LIGNE, pas une
 * projection — et une ligne ne se publie pas, ni telle quelle, ni par
 * étalement.
 *
 * **Ce qu'il ne couvre pas, écrit plutôt que laissé à découvrir.** Il ne suit
 * pas la donnée : une ligne recomposée champ par champ lui échappe, et c'est
 * voulu — c'est précisément la forme correcte. Ce qu'il attrape est l'absence
 * de décision, pas une décision qu'on jugerait mauvaise.
 *
 * Il remplace le contrôle qui vivait dans `compte.test.ts` et qui ne portait
 * que sur `prisma.user` : la même règle écrite deux fois finit avec une
 * version en retard, et c'est le motif que ce projet paie en boucle.
 */

const API = join(process.cwd(), "src", "app", "api");

/**
 * Les méthodes qui rendent des LIGNES.
 *
 * `groupBy`, `count` et `aggregate` en sont volontairement absents : ils ne
 * rendent que ce qu'on leur demande — les champs de `by` et les agrégats — et
 * **ils n'acceptent pas de `select`**. Les exiger ici ferait crier le garde
 * sur du code auquel la règle ne peut pas s'appliquer, et un garde qui crie
 * sur ce qui va bien finit par ne plus se lire.
 *
 * `updateMany`, `deleteMany` et `createMany` non plus : ils rendent `{ count }`.
 */
const METHODES = "findUnique|findUniqueOrThrow|findFirst|findFirstOrThrow|findMany|create|update|upsert";
const LECTURE = new RegExp(
  String.raw`(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+(?:prisma|tx)\.([a-zA-Z]+)\.(?:${METHODES})\s*\(`,
  "g",
);

/**
 * Le corps de l'appel, borné par ses PARENTHÈSES et non par un nombre de
 * caractères.
 *
 * C'est le piège déjà payé sur le garde des ponts de chargement : « les 400
 * caractères qui suivent » laissent lire la déclaration d'après. Ici l'effet
 * serait pire que bruyant, il serait SILENCIEUX — un appel sans `select`
 * suivi d'un appel qui en porte un passerait pour une projection, et le garde
 * rendrait vert sur la lecture qu'il existe pour attraper.
 */
export function corpsAppel(texte: string, depuis: number): string {
  const debut = texte.indexOf("(", depuis);
  if (debut < 0) return "";
  let prof = 0;
  for (let i = debut; i < texte.length; i++) {
    if (texte[i] === "(") prof++;
    else if (texte[i] === ")") {
      prof--;
      if (prof === 0) return texte.slice(debut, i + 1);
    }
  }
  return texte.slice(debut);
}

/** Le tri qui distingue une LIGNE d'une projection choisie. */
export const estBrut = (appel: string) => !/\bselect\s*:|\bomit\s*:/.test(appel);

/**
 * Les routes dispensées, avec leur raison.
 *
 * Vide aujourd'hui, et ce n'est pas un oubli : les treize lectures brutes du
 * dossier servent toutes à décider quelque chose — semer une configuration,
 * compter, vérifier qu'une partie n'est pas déjà enregistrée — et aucune ne
 * traverse le réseau.
 */
const DISPENSES: Record<string, string> = {};

function routes(dossier: string, out: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const c = join(dossier, e.name);
    if (e.isDirectory()) routes(c, out);
    else if (/^route\.tsx?$/.test(e.name)) out.push(c);
  }
  return out;
}

type Lecture = { rel: string; nom: string; modele: string; brut: boolean };

function recenser() {
  const lectures: Lecture[] = [];
  const fautives: string[] = [];

  for (const f of routes(API)) {
    const rel = relative(API, f).split("\\").join("/");
    if (DISPENSES[rel]) continue;
    const texte = readFileSync(f, "utf8");

    LECTURE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LECTURE.exec(texte))) {
      const appel = corpsAppel(texte, m.index + m[0].length - 1);
      const brut = estBrut(appel);
      lectures.push({ rel, nom: m[1], modele: m[2], brut });
      if (!brut) continue;

      const nom = m[1];
      const apres = texte.slice(m.index);
      /**
       * Deux formes, et la seconde est celle qui a mordu ici.
       *
       * La publication directe se voit en relisant la route ; l'ÉTALEMENT,
       * non — `{ ...ligne, membres: 1 }` se lit comme une composition alors
       * qu'il publie tout ce qu'on lui remet.
       */
      const publie = new RegExp(String.raw`NextResponse\.json\(\s*${nom}\b`).test(apres);
      const etale = new RegExp(String.raw`\.\.\.\s*${nom}\b`).test(apres);
      if (publie || etale) {
        fautives.push(
          `${rel} : ${m[2]} → ${nom} ${publie ? "publiée telle quelle" : "étalée"} sans select ni omit`,
        );
      }
    }
  }
  return { lectures, fautives };
}

describe("une ligne de base ne traverse pas le réseau sans nommer ses colonnes", () => {
  it("aucune route ne publie une ligne brute", () => {
    const { lectures, fautives } = recenser();
    expect(fautives).toEqual([]);

    /**
     * Sans ce témoin, un motif devenu aveugle — un dossier renommé, une
     * méthode Prisma rebaptisée — rendrait le contrôle vert en n'ayant
     * reconnu aucune lecture.
     */
    expect(lectures.length).toBeGreaterThanOrEqual(40);

    /**
     * Et sans celui-ci, un découpage cassé le rendrait vert AUTREMENT : en
     * faisant passer toutes les lectures pour des projections. Les deux
     * classes doivent rester peuplées.
     */
    expect(lectures.filter((l) => l.brut).length).toBeGreaterThanOrEqual(5);
    expect(lectures.filter((l) => !l.brut).length).toBeGreaterThanOrEqual(20);
  });

  it("distingue une ligne brute d'une projection choisie", () => {
    // Éprouvé sur des cas FABRIQUÉS : l'état sain du dépôt est zéro
    // trouvaille, donc les fichiers réels ne distinguent pas un tri juste
    // d'un tri aveugle.
    expect(estBrut("({ where: { id }, data })")).toBe(true);
    expect(estBrut("({ where: { id }, data, select: { pseudo: true } })")).toBe(false);
    expect(estBrut("({ where: { id }, omit: { passwordHash: true } })")).toBe(false);
    // Un `select` posé sur une RELATION reste une projection : quelqu'un a
    // décidé de ce qui sort, à un niveau plus bas.
    expect(estBrut("({ select: { id: true, user: { select: { pseudo: true } } } })")).toBe(false);
  });

  it("le découpage s'arrête à la fin de l'appel", () => {
    /**
     * Le cas qui compte : une lecture SANS `select` suivie d'une lecture qui
     * en porte un. Un découpage qui déborde ferait passer la première pour
     * une projection — donc rendrait le garde aveugle à la seule forme qu'il
     * existe pour attraper.
     */
    const source = [
      "const a = await prisma.user.findUnique({ where: { id } });",
      "const b = await prisma.user.findMany({ select: { pseudo: true } });",
    ].join("\n");
    const premier = source.indexOf("findUnique");
    expect(estBrut(corpsAppel(source, premier))).toBe(true);
    expect(corpsAppel(source, premier)).not.toContain("select");

    // Et les parenthèses imbriquées ne le coupent pas trop tôt.
    const imbrique = "await prisma.game.findMany({ where: { d: new Date(Date.now()) }, select: { id: true } })";
    expect(corpsAppel(imbrique, 0)).toContain("select");
    expect(estBrut(corpsAppel(imbrique, 0))).toBe(false);
  });

  it("chaque dispense, s'il en revient une, désigne une route qui existe", () => {
    for (const rel of Object.keys(DISPENSES)) {
      expect(existsSync(join(API, rel))).toBe(true);
    }
  });
});
