"use client";
import { useEffect, useState } from "react";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { translateApiError } from "@/lib/i18n/apiErrors";
import { adminTools } from "@/lib/i18n/dictionaries/adminTools";

export default function AdminTools() {
  const t = useT(adminTools);
  const { locale } = useLocale();
  const [emails, setEmails] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/whitelist")
      .then(r => r.json())
      .then(d => { if (d.emails) setEmails(d.emails); });
  }, []);

  async function add() {
    if (!input.trim()) return;
    setSaving(true);
    setMsg("");
    const res = await fetch("/api/admin/whitelist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: input.trim() }),
    });
    const d = await res.json();
    if (d.emails) { setEmails(d.emails); setInput(""); setMsg(t.added); }
    else setMsg(translateApiError(d.error, locale) || t.error);
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  }

  async function remove(email: string) {
    await fetch("/api/admin/whitelist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setEmails(prev => prev.filter(e => e !== email));
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
        <p style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(152,162,176,0.45)", marginBottom: 8 }}>
          {t.whitelistTitle}
        </p>
        <p style={{ fontSize: "0.78rem", color: "rgba(236,239,244,0.4)", lineHeight: 1.6, marginBottom: 10 }}>
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
              color: "#ECEFF4", outline: "none",
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
        {msg && <p style={{ fontSize: "0.78rem", color: msg.startsWith("✓") ? "#2FD98A" : "#FF5A47", marginBottom: 8 }}>{msg}</p>}
        {emails.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {emails.map(e => (
              <div key={e} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 10px", borderRadius: 4, background: "rgba(47,217,138,0.06)", border: "1px solid rgba(47,217,138,0.15)" }}>
                <span style={{ fontSize: "0.82rem", color: "rgba(236,239,244,0.7)" }}>{e}</span>
                <button
                  onClick={() => remove(e)}
                  style={{ background: "none", border: "none", color: "#FF5A47", cursor: "pointer", fontSize: "0.85rem", padding: "0 4px" }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
        {emails.length === 0 && (
          <p style={{ fontSize: "0.78rem", color: "rgba(236,239,244,0.25)" }}>{t.noEmails}</p>
        )}
      </div>

      {/* Rejouer intro */}
      <div style={{ borderTop: "1px solid rgba(152,162,176,0.1)", paddingTop: 14 }}>
        <p style={{ fontSize: "0.7rem", color: "rgba(236,239,244,0.3)", letterSpacing: "0.08em", marginBottom: "0.6rem" }}>
          {t.testSection}
        </p>
        <button
          onClick={() => {
            localStorage.removeItem("low_onboarded");
            localStorage.removeItem("splash");
            window.location.href = "/dashboard";
          }}
          style={{
            width: "100%",
            padding: "0.55rem",
            background: "transparent",
            border: "1px dashed rgba(152,162,176,0.2)",
            borderRadius: 4,
            color: "rgba(152,162,176,0.45)",
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
