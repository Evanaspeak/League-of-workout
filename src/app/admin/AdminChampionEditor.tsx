"use client";
import { useEffect, useState } from "react";
import { CHAMPIONS } from "@/lib/champions";
import { useLocale, useT } from "@/lib/i18n/LocaleContext";
import { translateApiError } from "@/lib/i18n/apiErrors";
import { adminChampionEditor } from "@/lib/i18n/dictionaries/adminChampionEditor";

export default function AdminChampionEditor() {
  const t = useT(adminChampionEditor);
  const { locale } = useLocale();
  const [text, setText] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/config/champions")
      .then((r) => r.json())
      .then((data) => {
        setText((data.champions as string[]).join("\n"));
        setIsDefault(data.isDefault ?? false);
        setLoading(false);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const champions = text.split("\n").map((s) => s.trim()).filter(Boolean);
    const res = await fetch("/api/admin/config/champions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ champions }),
    });
    const data = await res.json();
    setSaving(false);
    if (res.ok) {
      setMsg({ type: "ok", text: t.saved(data.count) });
      setIsDefault(false);
    } else {
      setMsg({ type: "err", text: translateApiError(data.error, locale) ?? t.error });
    }
  };

  const reset = async () => {
    setSaving(true);
    setMsg(null);
    await fetch("/api/admin/config/champions", { method: "DELETE" });
    setText(CHAMPIONS.join("\n"));
    setIsDefault(true);
    setSaving(false);
    setMsg({ type: "ok", text: t.resetDone });
  };

  const count = text.split("\n").map((s) => s.trim()).filter(Boolean).length;

  return (
    <div className="lol-panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="gold-text text-sm font-semibold uppercase tracking-widest">{t.title}</h2>
          <p className="text-xs mt-1" style={{ color: "rgba(240,230,211,0.4)" }}>
            {t.subtitle}
          </p>
        </div>
        <span className="text-xs px-3 py-1 rounded" style={{
          background: "rgba(200,170,110,0.1)",
          border: "1px solid rgba(200,170,110,0.2)",
          color: "rgba(200,170,110,0.7)",
        }}>
          {loading ? t.loadingShort : t.championsCount(count)}
          {isDefault && !loading && (
            <span style={{ color: "rgba(240,230,211,0.35)", marginLeft: 6 }}>{t.defaultTag}</span>
          )}
        </span>
      </div>

      {loading ? (
        <div className="text-center py-10 gold-text text-sm">{t.loading}</div>
      ) : (
        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setMsg(null); }}
          rows={20}
          className="lol-input w-full font-mono"
          style={{ fontSize: "0.8rem", lineHeight: 1.9, resize: "vertical" }}
          spellCheck={false}
        />
      )}

      {msg && (
        <div className="text-sm px-3 py-2 rounded" style={{
          background: msg.type === "ok" ? "rgba(76,175,80,0.1)" : "rgba(220,80,80,0.1)",
          border: `1px solid ${msg.type === "ok" ? "rgba(76,175,80,0.3)" : "rgba(220,80,80,0.3)"}`,
          color: msg.type === "ok" ? "#4caf50" : "#e05555",
        }}>
          {msg.text}
        </div>
      )}

      <div className="flex gap-3">
        <button
          className="lol-btn flex-1"
          onClick={save}
          disabled={saving || loading}
        >
          {saving ? t.saving : t.save}
        </button>
        <button
          onClick={reset}
          disabled={saving || loading || isDefault}
          className="px-5 py-2 rounded text-sm"
          style={{
            background: "rgba(200,170,110,0.08)",
            border: "1px solid rgba(200,170,110,0.2)",
            color: isDefault ? "rgba(240,230,211,0.2)" : "rgba(200,170,110,0.6)",
            cursor: isDefault ? "default" : "pointer",
          }}
        >
          {t.reset}
        </button>
      </div>
    </div>
  );
}
