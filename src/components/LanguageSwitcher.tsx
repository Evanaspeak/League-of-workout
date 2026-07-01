"use client";
import { useState, useRef, useEffect } from "react";
import { useLocale } from "@/lib/i18n/LocaleContext";

const OPTIONS: { code: "fr" | "en"; flag: string; label: string }[] = [
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "en", flag: "🇬🇧", label: "English" },
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
          background: "rgba(240,230,211,0.04)",
          border: "1px solid rgba(200,170,110,0.18)",
          cursor: "pointer",
          fontSize: "0.85rem",
        }}
      >
        <span style={{ lineHeight: 1 }}>{current.flag}</span>
        <span style={{ fontSize: "0.65rem", color: "rgba(240,230,211,0.4)" }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            background: "rgba(10,14,22,0.98)",
            border: "1px solid rgba(200,170,110,0.2)",
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
                background: o.code === locale ? "rgba(200,170,110,0.08)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: "0.8rem",
                color: o.code === locale ? "#C8AA6E" : "rgba(240,230,211,0.65)",
                textAlign: "left",
              }}
            >
              <span>{o.flag}</span>
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
