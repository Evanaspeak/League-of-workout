import { uniteLocalisee as unite } from "./unite";

/**
 * Une durée d'effort, écrite dans la langue de qui la lit.
 *
 * `formaterDuree` écrivait « min » et « s » en toutes lettres, donc en
 * français dans les six langues : un écran japonais affichait « 1 min 55 » au
 * milieu de ses idéogrammes, et un écran allemand « 5 min » là où on écrit
 * « 5 Min. ». C'est l'unité de la DETTE — elle vit sur la pastille, dans le
 * décompte, dans l'historique, sur la source de diffusion et dans les deux
 * notifications.
 *
 * `Intl` connaît les unités, et c'est lui qui les donne : aucune table de
 * « min » et de « s » n'est écrite à la main. Ce qu'il ne connaît PAS, c'est
 * la forme COMPOSÉE — « 5 min 07 » — parce que ce n'est pas une unité, c'est
 * un cadran. `Intl.DurationFormat` le saurait ; il n'existe pas dans le Node
 * de ce projet, vérifié plutôt que supposé.
 *
 * La composition se décide donc par langue, comme les phrases de défi : une
 * forme unique produirait « 5分钟 07 » en chinois, où l'on écrit « 5分07秒 ».
 */

/** La langue d'une étiquette BCP 47 : « ja-JP » → « ja ». */
function langueDe(etiquette: string): string {
  return etiquette.split("-")[0];
}


/**
 * Les secondes gardent leurs deux chiffres : « 5 min 07 » et non « 5 min 7 »,
 * qui se lit comme cinq minutes et sept minutes. Ce n'est pas un nombre à
 * grouper, c'est un cadran — d'où le passage par `String` et non par `Intl`.
 */
const pad = (n: number) => String(n).padStart(2, "0");

/**
 * La forme composée, par langue.
 *
 * Le français, l'anglais, l'espagnol et l'allemand posent l'unité après le
 * nombre et laissent les secondes nues ; le chinois et le japonais encadrent
 * les deux. Le rendu FRANÇAIS est identique à celui d'avant ce module — c'est
 * la propriété qui rendait le changement sûr, et elle se vérifie.
 */
const COMPOSE: Record<string, (min: number, sec: number, etiquette: string) => string> = {
  zh: (min, sec) => `${min}分${pad(sec)}秒`,
  ja: (min, sec) => `${min}分${pad(sec)}秒`,
};

/**
 * Les minutes RONDES, pour les deux langues qui portent leur propre composé.
 *
 * `Intl` rend « 2 分 » en japonais — c'est la donnée CLDR, et elle porte une
 * espace. Le composé juste au-dessus écrit « 1分55秒 » sans espace, parce
 * qu'un cadran ne s'écrit pas autrement. Les deux formes se croisent sur le
 * même écran : les réglages proposent un seuil rond au-dessus d'un exemple de
 * dette composée, et l'œil voit deux typographies pour la même unité.
 *
 * La règle qui en sort : la langue qui écrit son composé à la main écrit
 * aussi sa forme ronde. Les quatre langues européennes n'en ont pas besoin —
 * `Intl` y rend les deux formes d'accord entre elles.
 */
const ROND: Record<string, (min: number) => string> = {
  zh: (min) => `${min}分钟`,
  ja: (min) => `${min}分`,
};

const composeParDefaut = (min: number, sec: number, etiquette: string) =>
  `${unite(min, "minute", etiquette)} ${pad(sec)}`;

/** 45 → « 45 s », 850 → « 14 min 10 », dans la langue demandée. */
export function dureeLocalisee(totalSecondes: number, etiquette: string): string {
  const s = Math.max(0, Math.round(totalSecondes));
  if (s < 60) return unite(s, "second", etiquette);
  const minutes = Math.floor(s / 60);
  const reste = s % 60;
  if (reste === 0) return (ROND[langueDe(etiquette)] ?? ((m: number) => unite(m, "minute", etiquette)))(minutes);
  return (COMPOSE[langueDe(etiquette)] ?? composeParDefaut)(minutes, reste, etiquette);
}
