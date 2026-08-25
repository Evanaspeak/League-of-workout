"use client";
import { Icone } from "@/components/Icone";
import { useEffect, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { translateApiError } from "@/lib/i18n/apiErrors";
import { adminTools } from "@/lib/i18n/dictionaries/adminTools";
import { oublierPremiereVisite } from "@/lib/premiereVisite";
import { useIdCompte } from "@/lib/useIdCompte";

export default function AdminTools() {
  const t = useT(adminTools);
  const { locale } = useLocale();
  // Les marques de première visite appartiennent au compte : c'est celle de
  // l'administrateur connecté que ce bouton efface, pas celle du navigateur.
  const uid = useIdCompte();
  const [emails, setEmails] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ texte: string; ok: boolean } | null>(null);

  useEffect(() => {
    fetch("/api/admin/whitelist")
      .then(r => r.json())
      .then(d => { if (d.emails) setEmails(d.emails); });
  }, []);

  async function add() {
    if (!input.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: input.trim() }),
      });
      const d = await res.json().catch(() => ({}));
      if (d.emails) { setEmails(d.emails); setInput(""); setMsg({ texte: t.added, ok: true }); }
      else setMsg({ texte: translateApiError(d.error, locale) || t.error, ok: false });
    } catch {
      setMsg({ texte: t.error, ok: false });
    } finally {
      setSaving(false);
    }
    setTimeout(() => setMsg(null), 3000);
  }

  async function remove(email: string) {
    // L'adresse ne quitte la liste que si elle a quitté la base : sinon on
    // croit avoir retiré un accès qui tient toujours.
    try {
      const res = await fetch("/api/admin/whitelist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) { setMsg({ texte: t.error, ok: false }); return; }
      setEmails(prev => prev.filter(e => e !== email));
    } catch {
      setMsg({ texte: t.error, ok: false });
    }
  }

  return (
    <div className="lol-panel p-4" style={{ marginTop: 24 }}>
      <h2 style={{
        fontFamily: "var(--font-heading)",
        fontSize: "1rem",
        color: "#ECEFF4",
        letterSpacing: "0.1em",
        marginBottom: 16,
      }}>
        {t.title}
      </h2>

      {/* Liste blanche d'emails */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--faint)", marginBottom: 8 }}>
          {t.whitelistTitle}
        </p>
        <p style={{ fontSize: "0.78rem", color: "var(--faint)", lineHeight: 1.6, marginBottom: 10 }}>
          {t.whitelistExplanation}
        </p>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
            placeholder={t.emailPlaceholder}
            style={{
              flex: 1, padding: "7px 12px", borderRadius: 6, fontSize: "0.85rem",
              background: "rgba(236,239,244,0.04)", border: "1px solid rgba(152,162,176,0.2)",
              color: "#ECEFF4",
            }}
          />
          <button
            onClick={add}
            disabled={saving || !input.trim()}
            style={{
              padding: "7px 16px", borderRadius: 6, fontSize: "0.82rem", cursor: "pointer",
              background: "rgba(47,217,138,0.1)", border: "1px solid rgba(47,217,138,0.35)",
              color: "#2FD98A", fontWeight: 600,
            }}
          >
            {saving ? "..." : t.authorize}
          </button>
        </div>
        {msg && (
          <p style={{
            fontSize: "0.78rem", marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
            color: msg.ok ? "#2FD98A" : "#FF5A47",
          }}>
            <Icone nom={msg.ok ? "coche" : "croix"} taille={13} />
            {msg.texte}
          </p>
        )}
        {emails.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {emails.map(e => (
              <div key={e} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 10px", borderRadius: 4, background: "rgba(47,217,138,0.06)", border: "1px solid rgba(47,217,138,0.15)" }}>
                <span style={{ fontSize: "0.82rem", color: "var(--bone)" }}>{e}</span>
                <button
                  onClick={() => remove(e)}
                  style={{ background: "none", border: "none", color: "#FF5A47", cursor: "pointer", fontSize: "0.85rem", padding: "0 4px" }}
                >
                  <Icone nom="croix" taille={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        {emails.length === 0 && (
          <p style={{ fontSize: "0.78rem", color: "var(--faint)" }}>{t.noEmails}</p>
        )}
      </div>

      {/* Rejouer intro */}
      <div style={{ borderTop: "1px solid rgba(152,162,176,0.1)", paddingTop: 14 }}>
        <p style={{ fontSize: "0.7rem", color: "var(--faint)", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
          {t.testSection}
        </p>
        <button
          onClick={() => {
            oublierPremiereVisite(uid);
            window.location.href = "/dashboard";
          }}
          style={{
            width: "100%",
            padding: "0.55rem",
            background: "transparent",
            border: "1px dashed rgba(152,162,176,0.2)",
            borderRadius: 4,
            color: "var(--faint)",
            fontSize: "0.78rem",
            cursor: "pointer",
            letterSpacing: "0.06em",
          }}
        >
          {t.replayIntro}
        </button>
      </div>
    </div>
  );
}
