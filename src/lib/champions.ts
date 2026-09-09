export const CHAMPIONS: string[] = [
  "Aatrox", "Ahri", "Akali", "Akshan", "Alistar", "Ambessa", "Amumu", "Anivia", "Annie",
  "Aphelios", "Ashe", "Aurelion Sol", "Aurora", "Azir", "Bard", "Bel'Veth", "Blitzcrank",
  "Brand", "Braum", "Briar", "Caitlyn", "Camille", "Cassiopeia", "Cho'Gath", "Corki",
  "Darius", "Diana", "Dr. Mundo", "Draven", "Ekko", "Elise", "Evelynn", "Ezreal",
  "Fiddlesticks", "Fiora", "Fizz", "Galio", "Gangplank", "Garen", "Gnar", "Gragas",
  "Graves", "Gwen", "Hecarim", "Heimerdinger", "Hwei", "Illaoi", "Irelia", "Ivern",
  "Janna", "Jarvan IV", "Jax", "Jayce", "Jhin", "Jinx", "K'Sante", "Kai'Sa", "Kalista",
  "Karma", "Karthus", "Kassadin", "Katarina", "Kayle", "Kayn", "Kennen", "Kha'Zix",
  "Kindred", "Kled", "Kog'Maw", "LeBlanc", "Lee Sin", "Leona", "Lillia", "Lissandra", "Locke",
  "Lucian", "Lulu", "Lux", "Malphite", "Malzahar", "Maokai", "Master Yi", "Mel",
  "Milio", "Miss Fortune", "Mordekaiser", "Morgana", "Naafiri", "Nami", "Nasus",
  "Nautilus", "Neeko", "Nidalee", "Nilah", "Nocturne", "Nunu & Willump", "Olaf",
  "Orianna", "Ornn", "Pantheon", "Poppy", "Pyke", "Qiyana", "Quinn", "Rakan", "Rammus",
  "Rek'Sai", "Rell", "Renata Glasc", "Renekton", "Rengar", "Riven", "Rumble", "Ryze",
  "Samira", "Sejuani", "Senna", "Seraphine", "Sett", "Shaco", "Shen", "Shyvana",
  "Singed", "Sion", "Sivir", "Skarner", "Smolder", "Sona", "Soraka", "Swain", "Sylas",
  "Syndra", "Tahm Kench", "Taliyah", "Talon", "Taric", "Teemo", "Thresh", "Tristana",
  "Trundle", "Tryndamere", "Twisted Fate", "Twitch", "Udyr", "Urgot", "Varus", "Vayne",
  "Veigar", "Vel'Koz", "Vex", "Vi", "Viego", "Viktor", "Vladimir", "Volibear",
  "Warwick", "Wukong", "Xayah", "Xerath", "Xin Zhao", "Yasuo", "Yone", "Yorick",
  "Yunara", "Yuumi", "Zaahen", "Zac", "Zed", "Zeri", "Ziggs", "Zilean", "Zoe", "Zyra",
];

/**
 * Les noms LOCALISÉS qui ne se ramènent pas d'eux-mêmes à leur forme
 * canonique, et ce qu'ils désignent.
 *
 * La liste ci-dessus est celle de Riot en anglais, et c'est ce qu'il faut :
 * `Game.champion` la stocke, l'icône de Data Dragon s'en déduit, et le compte
 * de maîtrise regroupe dessus. Un joueur français, lui, tape le nom qu'il
 * lit dans son client.
 *
 * L'aplatissement des accents et de la ponctuation en rattrape la plupart tout
 * seul — « Séraphine », « Zoé », « K'Santé », « Jarvan IV. » se ramènent à
 * leur forme anglaise sans rien d'autre. **Cinq n'y arrivent pas** : ce sont
 * de vraies traductions, pas des variantes typographiques.
 *
 * Mesuré contre Data Dragon 16.17.1 : deux en français, trois en espagnol,
 * aucune en allemand. Le japonais et le chinois, eux, traduisent les
 * cent soixante-treize — c'est une table entière, donc une décision, et elle
 * est posée dans `docs/questions-ouvertes.md` plutôt que prise ici.
 */
export const ALIAS_CHAMPIONS: Record<string, string> = {
  "Maître Yi": "Master Yi",
  "Maestro Yi": "Master Yi",
  Bardo: "Bard",
  "Nunu et Willump": "Nunu & Willump",
  "Nunu y Willump": "Nunu & Willump",
};

/* ────────────────────────────────────────────────────────────────────────
   Ce qu'une saisie DÉSIGNE, et ce que la base reçoit.

   Ces fonctions vivaient dans `useChampions.ts`, qui est `"use client"` : une
   route ne pouvait donc pas les appeler, et la porte d'écriture normalisait
   d'un côté et pas de l'autre. Elles sont pures — elles ne connaissent que la
   liste qu'on leur passe — donc elles n'ont rien à faire dans un module de
   crochet React.
   ──────────────────────────────────────────────────────────────────────── */

/**
 * Vrai si le nom est EXACTEMENT celui d'un champion, à la casse près.
 *
 * C'est ce que la base doit recevoir : `Game.champion` stocke cette chaîne,
 * l'icône de Data Dragon s'en déduit, et le compte de maîtrise regroupe
 * dessus. « Chogath » enregistré à la place de « Cho'Gath » donnerait une
 * icône cassée et deux champions là où il n'y en a qu'un.
 *
 * Ce qu'on tape, en revanche, n'a aucune raison d'être exact : c'est
 * `resoudreChampion` qui fait le pont, et le formulaire résout AVANT de
 * vérifier.
 */
export function championConnu(liste: string[], nom: string): boolean {
  const normalise = nom.trim().toLowerCase();
  return liste.some((c) => c.toLowerCase() === normalise);
}

/** Ramène « Cho'Gath » à « chogath » : on tape rarement les apostrophes. */
function aplatir(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’.\s&-]/g, "");
}

/** Les morceaux d'un nom composé : « Aurelion Sol » → aurelion, sol. */
function mots(nom: string): string[] {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/['’.\s&-]+/)
    .filter(Boolean);
}

/**
 * Le champion que cette saisie désigne, sous sa forme canonique — ou `null`.
 *
 * **Le champ proposait ce que le bouton refusait**, et c'était le vrai défaut :
 * la liste déroulante aplatit les accents et la ponctuation, la validation
 * comparait la chaîne exacte. On tapait « Chogath », on voyait « Cho'Gath »
 * proposé, on ne cliquait pas, et le bouton d'enregistrement restait éteint
 * sans rien dire. Deux règles pour une seule question, ce que ce projet paie
 * en boucle.
 *
 * La résolution ne rend un nom que si l'aplatissement en désigne **un seul** :
 * deviner entre deux champions serait enregistrer une partie qui n'est pas
 * celle qu'on a jouée. Aucune collision aujourd'hui — un test l'éprouve sur
 * la liste entière, parce que c'est le jour où Riot en ajoute un que ça
 * changerait.
 */
export function resoudreChampion(liste: string[], saisie: string): string | null {
  const brut = saisie.trim();
  if (!brut) return null;
  const exact = liste.find((c) => c.toLowerCase() === brut.toLowerCase());
  if (exact) return exact;

  const q = aplatir(brut);
  if (!q) return null;

  const candidats = liste.filter((c) => aplatir(c) === q);
  if (candidats.length === 1) return candidats[0];
  if (candidats.length > 1) return null;

  // Les noms traduits, qui ne se ramènent pas d'eux-mêmes.
  for (const [localise, canonique] of Object.entries(ALIAS_CHAMPIONS)) {
    if (aplatir(localise) === q) return liste.includes(canonique) ? canonique : null;
  }
  return null;
}

/**
 * Propositions classées par pertinence. Taper « r » doit d'abord donner Rakan
 * et Renekton, pas Aatrox : un champion qui contient la lettre quelque part au
 * milieu n'est presque jamais celui qu'on cherche. L'ordre est donc :
 * début du nom, puis début d'un mot du nom, puis simple présence — et
 * alphabétique à pertinence égale.
 */
export function suggererChampions(liste: string[], requete: string, limite = 8): string[] {
  const q = aplatir(requete);
  if (!q) return [];

  const rang = (nom: string): number => {
    if (aplatir(nom).startsWith(q)) return 0;
    if (mots(nom).some((m) => m.startsWith(q))) return 1;
    if (aplatir(nom).includes(q)) return 2;
    return 3;
  };

  /**
   * On cherche aussi sur les noms TRADUITS, et on propose le canonique.
   *
   * Sans ça, « Maî » ne rend rien : le champ resterait muet devant quelqu'un
   * qui tape le nom qu'il lit dans son client. Ce qui s'affiche reste le nom
   * anglais, parce que c'est lui qu'on enregistre — proposer « Maître Yi »
   * puis stocker « Master Yi » ferait deux vérités.
   */
  const candidats: { nom: string; r: number }[] = liste.map((nom) => ({ nom, r: rang(nom) }));
  for (const [localise, canonique] of Object.entries(ALIAS_CHAMPIONS)) {
    if (!liste.includes(canonique)) continue;
    const r = rang(localise);
    const deja = candidats.find((c) => c.nom === canonique);
    if (deja) deja.r = Math.min(deja.r, r);
    else if (r < 3) candidats.push({ nom: canonique, r });
  }

  return candidats
    .filter((x) => x.r < 3)
    .sort((a, b) => a.r - b.r || a.nom.localeCompare(b.nom, "en"))
    .slice(0, limite)
    .map((x) => x.nom);
}

/**
 * Le nom affiché contre la CLÉ que Data Dragon emploie dans ses adresses.
 *
 * Une TROISIÈME correspondance sur les noms de champions, après la liste
 * elle-même et les alias traduits — et elle vivait dans un composant, où rien
 * ne pouvait la regarder. Elle décide de l'icône : une clé fausse rend une
 * image qui 404, donc le repli en lettre, et personne ne le remarque avant des
 * semaines.
 *
 * Le repli mécanique — retirer apostrophes, espaces, points et esperluettes —
 * suffit pour « K'Sante » ou « Lee Sin » ; il échoue partout où Riot met une
 * minuscule au second morceau (« Cho'Gath » donne « ChoGath », la clé est
 * « Chogath »). La table ne porte donc QUE ce que le repli manque, et une
 * entrée qui ne change rien y serait du bruit — `Aatrox` en était une.
 *
 * Vérifié contre Data Dragon 16.17.1 : `cleDataDragon` rend la bonne clé pour
 * les cent soixante-treize, et deux champions ne partagent jamais une clé. Ce
 * contrôle-là demande le réseau ; ce que `champions.test.ts` garde sans lui,
 * c'est la cohérence interne — pas d'entrée sans effet, pas d'entrée qui
 * désigne un champion absent de la liste, pas de collision.
 */
export const CLE_DATA_DRAGON: Record<string, string> = {
  "Bel'Veth":          "Belveth",
  "Cho'Gath":          "Chogath",
  "Dr. Mundo":         "DrMundo",
  "Jarvan IV":         "JarvanIV",
  "Kai'Sa":            "Kaisa",
  "Kha'Zix":           "Khazix",
  "Kog'Maw":           "KogMaw",
  "LeBlanc":           "Leblanc",
  "Lee Sin":           "LeeSin",
  "Master Yi":         "MasterYi",
  "Miss Fortune":      "MissFortune",
  "Nunu & Willump":    "Nunu",
  "Rek'Sai":           "RekSai",
  "Renata Glasc":      "Renata",
  "Tahm Kench":        "TahmKench",
  "Twisted Fate":      "TwistedFate",
  "Vel'Koz":           "Velkoz",
  "Wukong":            "MonkeyKing",
  "Xin Zhao":          "XinZhao",
  "Aurelion Sol":      "AurelionSol",
};

/** L'identifiant Data Dragon d'un champion, pour son icône. */
export function cleDataDragon(nom: string): string {
  return CLE_DATA_DRAGON[nom] ?? nom.replace(/['\s.&]/g, "");
}
