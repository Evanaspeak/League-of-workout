/**
 * Ce qu'une route fusionnée envoie, et ce que le navigateur déclare lire.
 *
 * `Progression` est un contrat de NOMS écrit à la main, dont tous les champs
 * sont des `unknown` : le type ne dit rien de leur contenu, il dit seulement
 * lesquels existent. C'est un choix raisonnable — les six panneaux vérifient
 * eux-mêmes ce qu'ils reçoivent — mais il laisse la frontière entièrement hors
 * du compilateur. Un champ renommé dans la route ne casse rien : `p?.defi`
 * devient `undefined`, le panneau reste `null`, et le tableau de bord perd un
 * bloc entier SANS erreur, sans test rouge, sans rien à l'écran qui le dise.
 *
 * C'est le défaut déjà gardé par `colonnesHistorique.test.ts`, un cran plus
 * loin : là-bas une colonne manquante laissait une case vide, ici c'est un
 * panneau entier qui ne se rend plus.
 *
 * Les deux listes sont donc lues à la source et comparées DANS LES DEUX SENS.
 * Un champ déclaré que la route n'envoie pas est un panneau mort ; un champ
 * envoyé que personne ne déclare est du volume payé pour rien, sur une route
 * appelée à chaque chargement du tableau de bord — et il reviendrait sans
 * bruit.
 *
 * **Et c'est une CLASSE, pas une ligne.** Les deux routes fusionnées de ce
 * projet ont exactement la même forme : un objet composé à la main d'un côté,
 * un type écrit à la main de l'autre, du JSON entre les deux et personne pour
 * tenir la frontière. Le tableau ci-dessous en porte deux ; une troisième
 * route fusionnée s'y ajoute en une ligne, et c'est le but — sans quoi la
 * suivante naîtrait sans garde, comme celles-ci.
 */
import { readFileSync } from "fs";
import { join } from "path";

const RACINE = join(__dirname, "..");

/** Une route fusionnée, le module qui la lit, et le type qu'il déclare. */
const CONTRATS = [
  {
    nom: "/api/progression",
    route: "src/app/api/progression/route.ts",
    client: "src/lib/chargerProgression.ts",
    type: "Progression",
  },
  {
    nom: "/api/contexte",
    route: "src/app/api/contexte/route.ts",
    client: "src/lib/chargerContexte.ts",
    type: "ContexteCompte",
  },
] as const;

/**
 * Les clés de l'objet rendu par la route.
 *
 * Le motif ne lit que ce qui suit `NextResponse.json({`, et ne retient que les
 * clés du PREMIER niveau — celles à quatre espaces d'indentation. Sans cette
 * borne, `badges: reponseBadges(...)` ramènerait aussi les champs des objets
 * imbriqués, et le garde comparerait deux listes qui ne parlent pas de la même
 * chose. C'est l'erreur déjà commise sur le contrat du pont Electron, où dix
 * membres d'objets imbriqués sont passés pour des méthodes manquantes.
 */
function champsEnvoyes(route: string): string[] {
  const src = readFileSync(join(RACINE, route), "utf8");
  /**
   * La forme MULTILIGNE, et pas le premier `NextResponse.json` venu.
   *
   * Le premier d'une route est presque toujours le 401, écrit sur une ligne.
   * Partir de lui faisait balayer tout ce qui suit — l'objet `source` compris —
   * et le garde rendait dix champs au lieu de six. Il tombait, ce qui est le
   * bon comportement, mais pour la mauvaise raison.
   */
  const debut = src.search(/NextResponse\.json\(\{\s*\n/);
  if (debut < 0) return [];
  const corps = src.slice(debut);
  return [...corps.matchAll(/^ {4}([a-zA-Z][a-zA-Z0-9_]*):/gm)].map((m) => m[1]);
}

/** Les champs déclarés par le type que le navigateur lit. Le `?` est du bruit. */
function champsDeclares(client: string, type: string): string[] {
  const src = readFileSync(join(RACINE, client), "utf8");
  const bloc = src.match(new RegExp(`export type ${type} = \\{([\\s\\S]*?)\\n\\};`));
  if (!bloc) return [];
  return [...bloc[1].matchAll(/^ {2}([a-zA-Z][a-zA-Z0-9_]*)\??:/gm)].map((m) => m[1]);
}

describe.each(CONTRATS)("les champs de $nom", ({ route, client, type }) => {
  /**
   * Le témoin, sans lequel rien de ce qui suit ne prouve quoi que ce soit.
   *
   * `toEqual([])` est vrai sur une liste vide : un motif devenu aveugle, un
   * fichier renommé, un `NextResponse.json` réécrit autrement, et le garde
   * passerait au vert en ne comparant rien. Trois, parce que c'est ce que
   * porte la plus petite des deux — il dit « on a lu quelque chose », pas
   * « on a lu exactement ça ».
   */
  it("lit vraiment les deux listes", () => {
    expect(champsEnvoyes(route).length).toBeGreaterThanOrEqual(3);
    expect(champsDeclares(client, type).length).toBeGreaterThanOrEqual(3);
  });

  it("tout ce que le navigateur déclare est bien envoyé", () => {
    const envoyes = new Set(champsEnvoyes(route));
    expect(champsDeclares(client, type).filter((c) => !envoyes.has(c))).toEqual([]);
  });

  it("tout ce qui est envoyé est déclaré par quelqu'un", () => {
    const declares = new Set(champsDeclares(client, type));
    expect(champsEnvoyes(route).filter((c) => !declares.has(c))).toEqual([]);
  });
});
