import { estLocale, type Locale } from "./langues";

/**
 * Les mots de la carte partagée.
 *
 * C'est la surface la plus vue du site quand un lien part sur Discord ou
 * Reddit, et elle était en français quelle que soit la langue de la page.
 *
 * **Le chinois et le japonais retombent sur l'anglais, et c'est délibéré.**
 * L'image est dessinée par le moteur de `next/og`, qui n'a que les polices
 * qu'on lui donne : sans police à idéogrammes embarquée — plusieurs
 * méga-octets à charger à chaque rendu — les caractères sortent en carrés
 * vides. Une carte anglaise se lit ; une carte de carrés ne se lit pas, et
 * c'est celle-là qu'on partage.
 *
 * À reprendre le jour où une police est embarquée pour de bon.
 */
type TextesImage = {
  accrocheHaut: string;
  accrocheBas: string;
  sousTitre: string;
  badge: string;
  jeux: string;
};

const LATINES: Record<string, TextesImage> = {
  fr: {
    accrocheHaut: "Tu perds une game,",
    accrocheBas: "tu fais des pompes.",
    sousTitre: "L'app calcule combien, d'après ton KDA et ton niveau de forme.",
    badge: "APPLICATION WINDOWS GRATUITE",
    jeux: "15 JEUX PRIS EN CHARGE",
  },
  en: {
    accrocheHaut: "You lose a game,",
    accrocheBas: "you do push-ups.",
    sousTitre: "The app works out how many, from your KDA and your fitness level.",
    badge: "FREE WINDOWS APP",
    jeux: "15 GAMES SUPPORTED",
  },
  es: {
    accrocheHaut: "Pierdes una partida,",
    accrocheBas: "haces flexiones.",
    sousTitre: "La app calcula cuántas, según tu KDA y tu nivel de forma.",
    badge: "APP DE WINDOWS GRATUITA",
    jeux: "15 JUEGOS COMPATIBLES",
  },
  de: {
    accrocheHaut: "Du verlierst,",
    accrocheBas: "du machst Liegestütze.",
    sousTitre: "Die App berechnet wie viele, aus deinem KDA und deinem Fitnesslevel.",
    badge: "KOSTENLOSE WINDOWS-APP",
    jeux: "15 SPIELE UNTERSTÜTZT",
  },
};

export function textesImageSociale(locale: unknown): TextesImage {
  const l: Locale | null = estLocale(locale) ? locale : null;
  return (l && LATINES[l]) ?? LATINES.en;
}
