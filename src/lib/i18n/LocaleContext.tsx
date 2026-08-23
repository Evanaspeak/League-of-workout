"use client";
import { createContext, useContext, useEffect, useMemo } from "react";
import { useValeurClient } from "@/lib/valeurClient";
import { estLocale, type Locale } from "./langues";

// La liste elle-même vit dans un module sans React : une route API qui valide
// une langue n'a pas à tirer tout le contexte avec elle. Réexportée ici, où
// une trentaine de composants la lisent déjà.
export { LANGUES, estLocale, type Locale } from "./langues";

/** Étiquette de langue pour les formats de date et de nombre. */
const ETIQUETTES: Record<Locale, string> = {
  fr: "fr-FR", en: "en-US", es: "es-ES", de: "de-DE", zh: "zh-CN", ja: "ja-JP",
};

const STORAGE_KEY = "low_locale";

/**
 * La langue vit hors de React : elle est lue dans le stockage du navigateur,
 * que le rendu serveur ne connaît pas. La poser dans un effet imposait un
 * second rendu de toute l'application à chaque chargement — et le temps de
 * celui-ci, un anglophone voyait la page en français.
 */
const abonnes = new Set<() => void>();

function abonner(onChange: () => void) {
  abonnes.add(onChange);
  return () => { abonnes.delete(onChange); };
}

/**
 * Un choix explicite prime toujours. À défaut, on suit la langue du
 * navigateur : le français par défaut envoyait tout le monde sur la version
 * française, y compris des anglophones qui n'avaient rien demandé.
 */
function lireLangue(): Locale {
  const stocke = localStorage.getItem(STORAGE_KEY);
  if (estLocale(stocke)) return stocke;
  // `navigator.language` rend « fr-BE », « zh-Hant-TW », « pt-BR »… Seule la
  // première étiquette nous intéresse, et ce qu'on ne connaît pas devient de
  // l'anglais plutôt que du français : le défaut français envoyait tout le
  // monde sur la version française, y compris ceux qui n'avaient rien demandé.
  const brut = (navigator.language || "").toLowerCase().split("-")[0];
  return estLocale(brut) ? brut : "en";
}

type Ctx = { locale: Locale; setLocale: (l: Locale) => void };
const LocaleContext = createContext<Ctx | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  // Le serveur rend en français : c'est la langue du contenu écrit d'abord.
  const locale = useValeurClient(lireLangue, "fr", abonner);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const valeur = useMemo<Ctx>(() => ({
    locale,
    setLocale: (l: Locale) => {
      localStorage.setItem(STORAGE_KEY, l);
      for (const prevenir of abonnes) prevenir();
    },
  }), [locale]);

  return (
    <LocaleContext.Provider value={valeur}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}

/** Renvoie le dictionnaire de la langue active pour un namespace `{ fr: {...}, en: {...} }`. */
/**
 * Les textes du composant, dans la langue active.
 *
 * Le français et l'anglais sont exigés ; les quatre autres langues sont
 * facultatives et se remplissent dictionnaire par dictionnaire. Ce qui n'est
 * pas encore traduit retombe sur l'anglais, silencieusement et volontairement :
 * une phrase anglaise au milieu d'un écran espagnol se comprend, un
 * `undefined` ne se comprend pas.
 */
export function useT<T extends { fr: Record<string, unknown> }>(
  dict: T & { en: T["fr"] } & Partial<Record<Locale, T["fr"]>>,
): T["fr"] {
  const { locale } = useLocale();
  return (dict as Partial<Record<Locale, T["fr"]>>)[locale] ?? dict.en;
}

/** Étiquette à passer aux formats de date et de nombre du navigateur. */
export function etiquetteLocale(locale: Locale): string {
  return ETIQUETTES[locale] ?? "en-US";
}

/** La même chose, pour un composant qui n'a pas la langue sous la main. */
export function useDateLocale(): string {
  const { locale } = useLocale();
  return etiquetteLocale(locale);
}

/**
 * Passe un mot en minuscule pour l'écrire au fil d'une phrase — sauf en
 * allemand, où les noms communs gardent leur majuscule. « 8 min 25 boxen »
 * n'est pas une faute de style : c'est une faute d'orthographe, et elle
 * apparaissait partout où un nom d'exercice suivait un nombre.
 *
 * La règle vit ici et non dans les écrans : c'est une propriété de la langue,
 * pas de la mise en page.
 */
export function enMinuscule(mot: string, locale: Locale): string {
  if (locale === "de") return mot;
  return mot.toLocaleLowerCase(etiquetteLocale(locale));
}

/** La même chose, pour un composant qui n'a pas la langue sous la main. */
export function useMinuscule(): (mot: string) => string {
  const { locale } = useLocale();
  return (mot: string) => enMinuscule(mot, locale);
}
