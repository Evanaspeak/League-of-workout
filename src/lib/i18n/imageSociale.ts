import { estLocale, type Locale } from "./langues";

/**
 * Les mots de la carte partagée.
 *
 * C'est la surface la plus vue du site quand un lien part sur Discord ou
 * Reddit, et elle était en français quelle que soit la langue de la page.
 *
 * **Le chinois et le japonais retombent sur l'anglais, et la raison écrite ici
 * était fausse.** Elle disait « sans police à idéogrammes embarquée, les
 * caractères sortent en carrés vides ». Mesuré, en rendant les trois écritures
 * par le moteur réel : le japonais et le chinois se dessinent **parfaitement**.
 *
 * Le mécanisme est ailleurs, et il compte davantage. La seule police embarquée
 * est `Geist-Regular.ttf` ; devant un glyphe qu'elle ne couvre pas, le moteur
 * VA LE CHERCHER — trois requêtes vers `fonts.googleapis.com` et
 * `fonts.gstatic.com`, relevées en traçant `fetch`, contre **zéro** pour un
 * texte latin. Les carrés vides n'arrivent que si ces requêtes échouent, et ils
 * arrivent alors pour de bon : rendu à part, le japonais sort en neuf tofus.
 *
 * Le repli anglais reste, et pour une raison qui n'est plus celle-là : cette
 * carte est demandée par un ROBOT — Discord, Reddit — avec un délai serré, et
 * trois allers-retours vers un tiers sur ce chemin-là se paient à chaque
 * prévisualisation. Les deux autres images du produit, celle du bilan et celle
 * d'une séance, sont demandées par la personne elle-même : elles écrivent leurs
 * idéogrammes, et leur commentaire dit ce que ça coûte.
 *
 * Une décision juste appuyée sur une cause fausse fait cesser de vérifier :
 * c'est le motif que ce journal reproche partout, et il était ici.
 */
/**
 * **Le compte de jeux vient du CATALOGUE, pas d'un nombre écrit ici.**
 *
 * Il valait « 15 » dans les quatre langues, six jours après l'entrée
 * d'Overwatch au catalogue — c'est-à-dire sur la carte que Discord et Reddit
 * affichent quand un lien du site y est collé, donc sur la surface la plus vue
 * par des inconnus. V450 avait corrigé onze occurrences de ce défaut et posé
 * un garde ; **le garde ne balaie que `dictionaries/`, et ce fichier vit un
 * dossier au-dessus.** Il est élargi avec cette correction.
 */
type TextesImage = {
  accrocheHaut: string;
  accrocheBas: string;
  sousTitre: string;
  badge: string;
  jeux: (n: number) => string;
};

const LATINES: Record<string, TextesImage> = {
  fr: {
    accrocheHaut: "Tu perds une game,",
    accrocheBas: "tu fais des pompes.",
    sousTitre: "L'app calcule combien, d'après ton KDA et ton niveau de forme.",
    badge: "APPLICATION WINDOWS GRATUITE",
    jeux: (n) => `${n} JEUX PRIS EN CHARGE`,
  },
  en: {
    accrocheHaut: "You lose a game,",
    accrocheBas: "you do push-ups.",
    sousTitre: "The app works out how many, from your KDA and your fitness level.",
    badge: "FREE WINDOWS APP",
    jeux: (n) => `${n} GAMES SUPPORTED`,
  },
  es: {
    accrocheHaut: "Pierdes una partida,",
    accrocheBas: "haces flexiones.",
    sousTitre: "La app calcula cuántas, según tu KDA y tu nivel de forma.",
    badge: "APP DE WINDOWS GRATUITA",
    jeux: (n) => `${n} JUEGOS COMPATIBLES`,
  },
  de: {
    accrocheHaut: "Du verlierst,",
    accrocheBas: "du machst Liegestütze.",
    sousTitre: "Die App berechnet wie viele, aus deinem KDA und deinem Fitnesslevel.",
    badge: "KOSTENLOSE WINDOWS-APP",
    jeux: (n) => `${n} SPIELE UNTERSTÜTZT`,
  },
};

export function textesImageSociale(locale: unknown): TextesImage {
  const l: Locale | null = estLocale(locale) ? locale : null;
  return (l && LATINES[l]) ?? LATINES.en;
}
