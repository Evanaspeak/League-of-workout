"use client";
import { fetchBorne } from "@/lib/reseau";
import { useEffect, useState } from "react";
import { CHAMPIONS } from "@/lib/champions";
import { invaliderChampions } from "@/lib/useChampions";
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

  /**
   * Une lecture qui échoue laissait « Chargement… » pour toujours.
   *
   * L'éditeur reste alors inerte — les deux boutons sont désactivés tant que
   * `loading` est vrai, donc rien ne pouvait être écrasé, ce qui est le bon
   * comportement. Mais rien ne le DISAIT : on attendait devant un panneau qui
   * ne chargerait plus jamais, sans savoir pourquoi. Et la promesse partait en
   * rejet non rattrapé.
   *
   * On garde le verrou et on ajoute la phrase. La liste des champions
   * s'applique à tous les comptes et sert à VALIDER une saisie : une liste
   * vide enregistrée par mégarde ferait refuser tous les champions du jeu.
   */
  const [lectureKO, setLectureKO] = useState(false);

  useEffect(() => {
    fetchBorne("/api/admin/config/champions")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!Array.isArray(data?.champions)) { setLectureKO(true); return; }
        setText((data.champions as string[]).join("\n"));
        setIsDefault(data.isDefault ?? false);
        setLoading(false);
      })
      .catch(() => setLectureKO(true));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    const champions = text.split("\n").map((s) => s.trim()).filter(Boolean);
    // Sans ce `try`, une coupure réseau laissait « Enregistrement… » à
    // l'écran pour toujours : la promesse partait en erreur et la ligne qui
    // l'efface n'était jamais atteinte.
    try {
      const res = await fetchBorne("/api/admin/config/champions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ champions }),
      });
      const data = await res.json();
      if (res.ok) {
        invaliderChampions();
        setMsg({ type: "ok", text: t.saved(data.count) });
        setIsDefault(false);
      } else {
        setMsg({ type: "err", text: translateApiError(data.error, locale) ?? t.error });
      }
    } catch {
      setMsg({ type: "err", text: t.error });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    setMsg(null);
    // La réponse était ignorée : « remis par défaut » s'affichait même quand
    // rien n'avait été remis.
    try {
      const res = await fetchBorne("/api/admin/config/champions", { method: "DELETE" });
      if (!res.ok) { setMsg({ type: "err", text: t.error }); return; }
      invaliderChampions();
      setText(CHAMPIONS.join("\n"));
      setIsDefault(true);
      setMsg({ type: "ok", text: t.resetDone });
    } catch {
      setMsg({ type: "err", text: t.error });
    } finally {
      setSaving(false);
    }
  };

  const count = text.split("\n").map((s) => s.trim()).filter(Boolean).length;

  return (
    <div className="lol-panel p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="titre-section">{t.title}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>
            {t.subtitle}
          </p>
        </div>
        <span className="text-xs px-3 py-1 rounded" style={{
          background: "color-mix(in srgb, var(--steel) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--steel) 20%, transparent)",
          color: "var(--steel)",
        }}>
          {loading ? t.loadingShort : t.championsCount(count)}
          {isDefault && !loading && (
            <span style={{ color: "var(--faint)", marginLeft: 6 }}>{t.defaultTag}</span>
          )}
        </span>
      </div>

      {loading ? (
        lectureKO ? (
          <p role="alert" className="text-center py-10 text-sm" style={{ color: "var(--ember)" }}>
            {t.lectureEchouee}
          </p>
        ) : (
          <div className="text-center py-10 gold-text text-sm">{t.loading}</div>
        )
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
        <div role="status" className="text-sm px-3 py-2 rounded" style={{
          background: msg.type === "ok" ? "var(--victory-soft)" : "rgba(220,80,80,0.1)",
          border: `1px solid ${msg.type === "ok" ? "color-mix(in srgb, var(--victory) 30%, transparent)" : "rgba(220,80,80,0.3)"}`,
          color: msg.type === "ok" ? "var(--victory)" : "#e05555",
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
            background: "color-mix(in srgb, var(--steel) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--steel) 20%, transparent)",
            color: isDefault ? "color-mix(in srgb, var(--bone) 20%, transparent)" : "var(--steel)",
            cursor: isDefault ? "default" : "pointer",
          }}
        >
          {t.reset}
        </button>
      </div>
    </div>
  );
}
