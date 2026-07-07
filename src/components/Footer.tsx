"use client";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleContext";
import { layout } from "@/lib/i18n/dictionaries/layout";
import { Wordmark } from "./Wordmark";

export function Footer() {
  const t = useT(layout);
  const path = usePathname();

  // La landing gère son propre pied de page via sa section CTA — on garde
  // quand même le footer légal partout, y compris "/", pour le disclaimer.
  const linkStyle: React.CSSProperties = {
    color: "var(--faint)",
    textDecoration: "none",
    fontSize: "0.75rem",
    letterSpacing: "0.04em",
  };

  return (
    <footer
      style={{
        borderTop: "1px solid var(--line)",
        padding: "28px 16px 32px",
        marginTop: path === "/" ? 0 : "2rem",
      }}
    >
      <div style={{
        maxWidth: 1100, margin: "0 auto",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        textAlign: "center",
      }}>
        <Wordmark fontSize="0.85rem" muted />
        <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", flexWrap: "wrap" }}>
          <a href="/cgu" style={linkStyle}>{t.footerCgu}</a>
          <a href="/confidentialite" style={linkStyle}>{t.footerConfidentialite}</a>
          <a href="/telechargement" style={linkStyle}>{t.footerTelecharger}</a>
        </div>
        <div style={{
          maxWidth: 640, margin: "0 auto", lineHeight: 1.6,
          fontSize: "0.68rem", color: "rgba(236,239,244,0.28)",
        }}>
          {t.disclaimer}
        </div>
      </div>
    </footer>
  );
}
