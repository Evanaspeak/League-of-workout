"use client";
import { Lien } from "@/components/Lien";
import { useT } from "@/lib/i18n/LocaleContext";
import { telechargement as telechargementDict } from "@/lib/i18n/dictionaries/telechargement";
import { Icone } from "@/components/Icone";

export function TelechargementClient({
  downloadUrl,
  version,
}: {
  downloadUrl: string | null;
  /** Version proposée au téléchargement, quand elle a pu être lue. */
  version?: string | null;
}) {
  const t = useT(telechargementDict);
  return (
    <div
      style={{ minHeight: "72vh", display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        className="lol-panel"
        style={{
          position: "relative",
          padding: "2.5rem 2rem",
          width: "100%",
          maxWidth: 480,
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        <span aria-hidden style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg, transparent 15%, var(--ember) 50%, transparent 85%)",
        }} />

        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.2rem" }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--steel)"
            strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <rect x="2" y="4" width="20" height="13" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </svg>
        </div>

        <h1
          style={{
            fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
            fontWeight: 700,
            fontSize: "1.4rem",
            color: "var(--bone)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: "0.5rem",
          }}
        >
          {t.title}
        </h1>

        <p
          style={{
            fontSize: "0.82rem",
            color: "var(--faint)",
            marginBottom: "2rem",
            lineHeight: 1.7,
          }}
        >
          {t.description}<br />
          {t.compatibilite}
        </p>

        {downloadUrl ? (
          <a
            href={downloadUrl}
            className="lol-btn"
            style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem" }}
          >
            {t.telecharger}
          </a>
        ) : null}

        {/* Savoir ce qu'on installe, et pouvoir le comparer à ce qu'on a déjà. */}
        {downloadUrl && version && (
          <p style={{ marginTop: "0.7rem", fontSize: "0.75rem", color: "var(--faint)" }}>
            {t.versionLabel(version)}
          </p>
        )}

        {/* Avertissement Windows, annoncé AVANT de le rencontrer.
            Ce qui fait renoncer les gens n'est pas l'avertissement — c'est de
            tomber dessus sans prévenir, sur un programme qu'ils viennent de
            télécharger. Dit à l'avance, il devient une formalité. */}
        {downloadUrl && (
          <div style={{
            marginTop: "1.6rem",
            padding: "1rem 1.15rem",
            borderRadius: 6,
            textAlign: "left",
            background: "rgba(255,180,84,0.06)",
            border: "1px solid rgba(255,180,84,0.28)",
          }}>
            <p style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: "0.8rem", fontWeight: 600, color: "var(--amber)", marginBottom: "0.6rem",
            }}>
              <Icone nom="alerte" taille={16} />
              {t.smartScreenTitre}
            </p>
            <p style={{ fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.7 }}>
              {t.smartScreenIntro}
            </p>
            {/* Les numéros sont rétablis explicitement : la remise à zéro des
                styles les enlève, or ici l'ordre des deux clics compte. */}
            <ol style={{
              margin: "0.6rem 0 0", paddingLeft: "1.4rem", listStyle: "decimal",
              fontSize: "0.78rem", color: "var(--muted)", lineHeight: 1.9,
            }}>
              <li>{t.smartScreenEtape1}</li>
              <li>{t.smartScreenEtape2}</li>
            </ol>

            <details style={{ marginTop: "0.85rem" }}>
              <summary style={{
                cursor: "pointer", fontSize: "0.75rem",
                color: "var(--faint)", listStyle: "none",
              }}>
                {t.smartScreenPourquoi}
              </summary>
              <p style={{
                marginTop: "0.5rem", fontSize: "0.75rem",
                color: "var(--faint)", lineHeight: 1.75,
              }}>
                {t.smartScreenExplication}
              </p>
            </details>
          </div>
        )}

        {!downloadUrl && (
          <div
            style={{
              padding: "1rem 1.25rem",
              borderRadius: 6,
              background: "rgba(152,162,176,0.05)",
              border: "1px solid rgba(152,162,176,0.15)",
              fontSize: "0.85rem",
              color: "var(--faint)",
              lineHeight: 1.7,
            }}
          >
            {t.bientotDisponible}
          </div>
        )}

        <div
          style={{
            marginTop: "2rem",
            paddingTop: "1.5rem",
            borderTop: "1px solid rgba(152,162,176,0.08)",
            fontSize: "0.75rem",
            color: "var(--faint)",
            lineHeight: 1.8,
            textAlign: "left",
          }}
        >
          <p style={{ fontWeight: 600, color: "var(--faint)", marginBottom: "0.5rem" }}>
            {t.commentCaFonctionne}
          </p>
          <ul className="liste-puces">
            <li>{t.etape1}</li>
            <li>{t.etape2}</li>
            <li>{t.etape3}</li>
            <li>{t.etape4}</li>
          </ul>
        </div>

        <div style={{ marginTop: "1.5rem" }}>
          <Lien
            href="/dashboard"
            style={{ fontSize: "0.78rem", color: "var(--faint)", textDecoration: "none" }}
          >
            {t.retourDashboard}
          </Lien>
        </div>
      </div>
    </div>
  );
}
