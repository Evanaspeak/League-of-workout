"use client";
import { useLocale, type Locale } from "@/lib/i18n/LocaleContext";

/**
 * Dit au lecteur que le document qu'il a sous les yeux n'existe pas dans sa
 * langue.
 *
 * Les CGU et la politique de confidentialité ne sont écrites qu'en français et
 * en anglais. Le reste de l'application se traduit ; ces deux pages retombent
 * donc sur l'anglais sans rien dire, et un lecteur allemand ou japonais peut
 * croire lire une version qui l'engage dans sa langue. Un texte juridique
 * traduit sans relecture engage autant que l'original : mieux vaut annoncer la
 * limite que la masquer.
 *
 * Le bandeau ne dit pas quelle version fait foi — c'est une clause juridique,
 * pas une constatation, et elle appartient au texte lui-même.
 */
const AVIS: Record<Locale, string> = {
  fr: "",
  en: "",
  es: "Este documento solo existe en francés y en inglés. Lo que sigue está en inglés.",
  de: "Dieses Dokument gibt es nur auf Französisch und Englisch. Der folgende Text ist auf Englisch.",
  zh: "本文件只有法语和英语版本。以下内容为英语。",
  ja: "この文書はフランス語と英語のみです。以下は英語の本文です。",
};

export function LangueDocument() {
  const { locale, setLocale } = useLocale();
  const avis = AVIS[locale];
  if (!avis) return null;

  return (
    <p
      role="note"
      style={{
        fontSize: "0.8rem",
        lineHeight: 1.6,
        color: "var(--muted)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: "0.75rem 1rem",
        marginTop: "1rem",
      }}
    >
      {avis}{" "}
      <button
        type="button"
        onClick={() => setLocale("fr")}
        style={{
          color: "var(--amber)",
          textDecoration: "underline",
          background: "none",
          border: 0,
          padding: 0,
          cursor: "pointer",
          font: "inherit",
        }}
      >
        Version française
      </button>
    </p>
  );
}
