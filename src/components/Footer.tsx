"use client";
import { useT } from "@/lib/i18n/LocaleContext";
import { layout } from "@/lib/i18n/dictionaries/layout";

export function Footer() {
  const t = useT(layout);
  return (
    <footer className="text-center py-4 text-xs space-y-1" style={{
      color: "rgba(200,170,110,0.25)",
      borderTop: "1px solid rgba(200,170,110,0.07)",
      letterSpacing: "0.06em",
    }}>
      <div>LEAGUE OF WORKOUTS · Via Riot Games API</div>
      <div style={{ display: "flex", justifyContent: "center", gap: "1.25rem" }}>
        <a href="/cgu" style={{ color: "rgba(200,170,110,0.35)", textDecoration: "none" }}>{t.footerCgu}</a>
        <a href="/confidentialite" style={{ color: "rgba(200,170,110,0.35)", textDecoration: "none" }}>{t.footerConfidentialite}</a>
        <a href="/telechargement" style={{ color: "rgba(200,170,110,0.35)", textDecoration: "none" }}>{t.footerTelecharger}</a>
      </div>
      <div style={{ maxWidth: 640, margin: "0 auto", lineHeight: 1.6 }}>
        {t.disclaimer}
      </div>
    </footer>
  );
}
