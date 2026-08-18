"use client";
import { Icone } from "@/components/Icone";
import { useState, useRef, useEffect } from "react";
import { useLocale } from "@/lib/i18n/LocaleContext";
import { Drapeau } from "./Drapeau";

/**
 * Drapeau et code de langue côte à côte. Le code prime : c'est lui qui nomme
 * la langue (EN, pas GB — l'anglais n'est pas un pays). Le drapeau ne sert
 * qu'à repérer l'option d'un coup d'œil, et il est dessiné plutôt qu'emoji :
 * Windows ne sait pas rendre les emoji de drapeaux.
 */
const OPTIONS: { code: "fr" | "en"; pays: "fr" | "us"; label: string }[] = [
  { code: "fr", pays: "fr", label: "Français" },
  { code: "en", pays: "us", label: "English" },
];

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = OPTIONS.find((o) => o.code === locale) ?? OPTIONS[0];

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Changer de langue / Change language"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "4px 8px",
          borderRadius: 6,
          background: "rgba(236,239,244,0.04)",
          border: "1px solid rgba(152,162,176,0.18)",
          cursor: "pointer",
          fontSize: "0.85rem",
        }}
      >
        <Drapeau pays={current.pays} taille={17} />
        <span style={{
          lineHeight: 1,
          fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
          fontWeight: 600,
          fontSize: "0.78rem",
          letterSpacing: "0.1em",
          color: "var(--bone)",
        }}>
          {current.code.toUpperCase()}
        </span>
        <Icone nom="chevron" taille={13} couleur="rgba(236,239,244,0.4)" />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "rgba(20,23,28,0.98)",
            border: "1px solid rgba(152,162,176,0.2)",
            borderRadius: 8,
            overflow: "hidden",
            minWidth: 140,
            zIndex: 60,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          }}
        >
          {OPTIONS.map((o) => (
            <button
              key={o.code}
              onClick={() => { setLocale(o.code); setOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 12px",
                background: o.code === locale ? "rgba(152,162,176,0.08)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "0.8rem",
                color: o.code === locale ? "#ECEFF4" : "rgba(236,239,244,0.65)",
                textAlign: "left",
              }}
            >
              <Drapeau pays={o.pays} taille={17} />
              <span style={{
                fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
                fontWeight: 600,
                fontSize: "0.72rem",
                letterSpacing: "0.1em",
                width: 22,
                color: o.code === locale ? "var(--amber)" : "rgba(236,239,244,0.45)",
              }}>
                {o.code.toUpperCase()}
              </span>
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
