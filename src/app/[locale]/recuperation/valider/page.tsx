"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { Lien } from "@/components/Lien";
import { useSearchParams } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleContext";
import { recuperation } from "@/lib/i18n/dictionaries/recuperation";
import { Wordmark } from "@/components/Wordmark";

/**
 * Ouverture du lien de récupération.
 *
 * C'est ici, et nulle part ailleurs, que l'ancien code cesse de fonctionner :
 * ouvrir le lien prouve qu'on relève bien la boîte de l'adresse concernée. La
 * demande, elle, ne touchait à rien — c'était tout le point de la correction.
 */
function Valider() {
  const t = useT(recuperation);
  const params = useSearchParams();
  const jeton = params.get("t") ?? "";

  // Sans jeton dans l'adresse, l'issue est connue dès le rendu : la poser
  // depuis l'effet déclencherait un rendu en cascade pour rien.
  const [etat, setEtat] = useState<"attente" | "ok" | "echec">(jeton ? "attente" : "echec");
  const [code, setCode] = useState("");
  const [pseudo, setPseudo] = useState("");

  // Le jeton est à usage unique : un second appel le trouverait déjà consommé.
  // En développement, React monte deux fois — sans ce garde, l'utilisateur
  // verrait « lien invalide » alors qu'il vient d'être échangé avec succès.
  const lance = useRef(false);

  useEffect(() => {
    if (lance.current || !jeton) return;
    lance.current = true;

    fetch("/api/auth/reset-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: jeton }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.code) { setEtat("echec"); return; }
        setCode(data.code);
        setPseudo(data.pseudo ?? "");
        setEtat("ok");
      })
      .catch(() => setEtat("echec"));
  }, [jeton]);

  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "56px 24px 100px" }}>
      <div
        style={{
          position: "relative",
          background: "var(--carbon)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          padding: "36px 28px",
          textAlign: "center",
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 2,
            background: `linear-gradient(90deg, transparent 15%, ${
              etat === "echec" ? "var(--ember)" : "var(--victory)"
            } 50%, transparent 85%)`,
          }}
        />

        {etat === "attente" && (
          <p style={{ fontSize: "0.92rem", color: "var(--muted)" }} aria-live="polite">
            {t.validerEnCours}
          </p>
        )}

        {etat === "ok" && (
          <>
            <div
              className="eyebrow"
              style={{
                display: "inline-block", marginBottom: 20, padding: "4px 16px",
                borderRadius: 999, border: "1px solid rgba(47,217,138,0.3)",
                background: "var(--victory-soft)", color: "var(--victory)",
              }}
            >
              {t.validerBadge}
            </div>
            <h1 className="titre-section" style={{ justifyContent: "center", marginBottom: 18 }}>
              {t.validerTitre}
            </h1>
            <div
              className="mono-num"
              style={{
                fontSize: "1.7rem", fontWeight: 700, letterSpacing: "0.2em",
                color: "var(--bone)", background: "rgba(12,14,17,0.7)",
                border: "1px dashed var(--line-strong)", borderRadius: 10,
                padding: "16px 8px", marginBottom: 20, wordBreak: "break-all",
              }}
            >
              {code}
            </div>
            <p style={{ fontSize: "0.88rem", color: "var(--muted)", lineHeight: 1.7, marginBottom: 10 }}>
              {t.validerCorps}
            </p>
            {pseudo && (
              <p style={{ fontSize: "0.85rem", color: "var(--faint)", lineHeight: 1.7, marginBottom: 24 }}>
                {t.validerPseudo(pseudo)}
              </p>
            )}
            <Lien href="/login" className="lol-btn" style={{ padding: "12px 28px", fontSize: "0.9rem" }}>
              {t.backToLogin}
            </Lien>
          </>
        )}

        {etat === "echec" && (
          <>
            <h1 className="titre-section" style={{ justifyContent: "center", marginBottom: 18 }}>
              {t.validerEchecTitre}
            </h1>
            <p style={{ fontSize: "0.9rem", color: "var(--muted)", lineHeight: 1.7, marginBottom: 24 }}>
              {t.validerEchecCorps}
            </p>
            <Lien href="/recuperation" className="lol-btn" style={{ padding: "12px 28px", fontSize: "0.9rem" }}>
              {t.validerRedemander}
            </Lien>
          </>
        )}
      </div>
    </div>
  );
}

export default function PageValider() {
  return (
    <div
      className="full-bleed"
      style={{
        background: "var(--ink)", minHeight: "100dvh", color: "var(--bone)",
        marginTop: "-1.5rem", marginBottom: "-1.5rem",
      }}
    >
      <nav
        style={{
          position: "sticky", top: 0, zIndex: 40,
          background: "rgba(12,14,17,0.85)", backdropFilter: "blur(14px)",
          WebkitBackdropFilter: "blur(14px)", borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center" }}>
          <Lien href="/" style={{ textDecoration: "none", display: "inline-flex" }}>
            <Wordmark fontSize="1.05rem" />
          </Lien>
        </div>
      </nav>

      {/* `useSearchParams` impose une frontière de suspense au prérendu. */}
      <Suspense fallback={null}>
        <Valider />
      </Suspense>
    </div>
  );
}
