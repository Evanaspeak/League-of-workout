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
