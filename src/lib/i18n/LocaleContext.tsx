"use client";
import { createContext, useContext, useEffect, useMemo } from "react";
import { useValeurClient } from "@/lib/valeurClient";

export type Locale = "fr" | "en";

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
  if (stocke === "fr" || stocke === "en") return stocke;
  return (navigator.language || "").toLowerCase().startsWith("fr") ? "fr" : "en";
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
export function useT<T extends { fr: Record<string, unknown> }>(dict: T & { en: T["fr"] }): T["fr"] {
  const { locale } = useLocale();
  return dict[locale];
}

/** Formate une date selon la langue active (fr-FR / en-US). */
export function useDateLocale(): string {
  const { locale } = useLocale();
  return locale === "fr" ? "fr-FR" : "en-US";
}
