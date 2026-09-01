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
    accrocheHaut: "Gagne ta game,",
    accrocheBas: "ou paie en sueur",
    sousTitre: "Chaque partie a un prix, calculé sur ta performance. Tu le paies en pompes, en squats ou en boxe.",
    badge: "APPLICATION WINDOWS GRATUITE",
    jeux: "15 JEUX PRIS EN CHARGE",
  },
  en: {
    accrocheHaut: "Win the game,",
    accrocheBas: "or pay in sweat",
    sousTitre: "Every match has a price, worked out from how you played. You pay it in push-ups, squats or boxing.",
    badge: "FREE WINDOWS APP",
    jeux: "15 GAMES SUPPORTED",
  },
  es: {
    accrocheHaut: "Gana la partida,",
    accrocheBas: "o paga sudando",
    sousTitre: "Cada partida tiene un precio, calculado según tu rendimiento. Lo pagas en flexiones, sentadillas o boxeo.",
    badge: "APP DE WINDOWS GRATUITA",
    jeux: "15 JUEGOS COMPATIBLES",
  },
  de: {
    accrocheHaut: "Gewinn dein Spiel,",
    accrocheBas: "oder zahl mit Schweiß",
    sousTitre: "Jede Partie hat ihren Preis, berechnet aus deiner Leistung. Du zahlst in Liegestützen, Kniebeugen oder Boxen.",
    badge: "KOSTENLOSE WINDOWS-APP",
    jeux: "15 SPIELE UNTERSTÜTZT",
  },
};

export function textesImageSociale(locale: unknown): TextesImage {
  const l: Locale | null = estLocale(locale) ? locale : null;
  return (l && LATINES[l]) ?? LATINES.en;
}
