import { etiquetteLocale, type Locale } from "./langues";

/**
 * Les trois mots de la source de diffusion.
 *
 * Ils étaient écrits en français dans le composant et s'affichaient tels quels
 * devant le public d'un stream — la seule surface du produit que des inconnus
 * regardent.
 *
 * Ils ne peuvent pas passer par `useT` : la page n'a pas de langue dans son
 * adresse, et pour cause — elle est ouverte par un logiciel de diffusion, avec
 * un jeton pour toute identité. La langue vient donc du COMPTE, remontée par
 * la route qui sert le compteur. C'est la même situation que les notifications
 * et le courriel hebdomadaire, et la même réponse.
 *
 * Le libellé de série est une abréviation d'un ou deux caractères : c'est une
 * pastille superposée à un jeu, pas une phrase.
 */
type TextesDiffusion = { aFaire: string; jours: string; lienInvalide: string };

const TEXTES: Record<Locale, TextesDiffusion> = {
  fr: { aFaire: "À faire", jours: "j", lienInvalide: "Lien invalide" },
  en: { aFaire: "To do", jours: "d", lienInvalide: "Invalid link" },
  es: { aFaire: "Pendiente", jours: "d", lienInvalide: "Enlace no válido" },
  de: { aFaire: "Offen", jours: "T", lienInvalide: "Ungültiger Link" },
  zh: { aFaire: "待完成", jours: "天", lienInvalide: "链接无效" },
  ja: { aFaire: "未消化", jours: "日", lienInvalide: "リンクが無効です" },
};

/**
 * La série, composée là où la langue est connue.
 *
 * Le composant écrivait `{serie} {textes.jours}` — un espace posé par le JSX —
 * ce qui donne « 3 日 » et « 3 天 » là où le japonais et le chinois écrivent
 * « 3日 » et « 3天 ». Le dictionnaire ne peut pas porter une fonction : il
 * traverse le réseau en JSON, et une fonction n'y survit pas. C'est donc la
 * ROUTE qui compose, comme elle compose déjà les lignes de dette.
 *
 * Le nombre passe par `Intl` au passage : une série de mille jours fait
 * presque trois ans, mais le séparateur ne coûte rien et le jour où il servira
 * personne ne relira ce fichier.
 */
const SANS_ESPACE: Locale[] = ["zh", "ja"];

export function serieDiffusion(jours: number, locale: unknown): string {
  const l = (TEXTES[locale as Locale] ? locale : "en") as Locale;
  const n = new Intl.NumberFormat(etiquetteLocale(l)).format(jours);
  return SANS_ESPACE.includes(l) ? `${n}${TEXTES[l].jours}` : `${n} ${TEXTES[l].jours}`;
}

export function textesDiffusion(locale: unknown): TextesDiffusion {
  return TEXTES[locale as Locale] ?? TEXTES.en;
}
