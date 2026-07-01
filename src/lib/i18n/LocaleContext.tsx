"use client";
import { createContext, useContext, useEffect, useState } from "react";

export type Locale = "fr" | "en";

const STORAGE_KEY = "low_locale";

type Ctx = { locale: Locale; setLocale: (l: Locale) => void };
const LocaleContext = createContext<Ctx | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("fr");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") setLocaleState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  function setLocale(l: Locale) {
    setLocaleState(l);
    localStorage.setItem(STORAGE_KEY, l);
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
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
