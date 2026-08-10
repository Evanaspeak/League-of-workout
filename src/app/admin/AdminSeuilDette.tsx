"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { adminSeuil } from "@/lib/i18n/dictionaries/adminSeuil";

/** Bornes du réglage : 2 h suffisent largement à tester tous les cas. */
const MAX_MIN = 120;

/**
 * Outil de test du compteur de boxe : il force sa valeur pour vérifier
 * l'alerte, la notification et le chronomètre sans devoir enregistrer des
 * parties jusqu'à franchir le seuil.
 *
 * Le seuil de déclenchement, lui, est un vrai réglage utilisateur et vit
 * dans Réglages.
 */
export default function AdminSeuilDette() {
  const t = useT(adminSeuil);

  const [minutes, setMinutes] = useState("5");
  const [secondes, setSecondes] = useState("0");
  const [actuelSec, setActuelSec] = useState<number | null>(null);
  const [seuilSec, setSeuilSec] = useState<number | null>(null);
  const [sansExercice, setSansExercice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/dette")
      .then((r) => r.json())
      .then((d) => {
        const sec = Number(d?.dureeSec);
        if (Number.isFinite(sec)) {
          setActuelSec(sec);
          setMinutes(String(Math.floor(sec / 60)));
          setSecondes(String(sec % 60));
        }
        if (Number.isFinite(Number(d?.seuilSec))) setSeuilSec(Number(d.seuilSec));
        setSansExercice(!Array.isArray(d?.exercices) || d.exercices.length === 0);
      })
      .catch(() => {});
  }, []);

  const total = Math.min(
    MAX_MIN * 60,
    Math.max(0, (Number(minutes) || 0) * 60 + (Number(secondes) || 0)),
  );

  const lisible = (sec: number) => {
    if (sec <= 0) return t.jamais;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s} ${t.secondes}`;
    return s === 0 ? `${m} ${t.minutes}` : `${m} ${t.minutes} ${s}`;
  };

  async function enregistrer() {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/dette", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secondes: total }),
      });
      if (res.ok) {
        const d = await res.json();
        setActuelSec(Number(d?.dureeSec) || 0);
        setMsg(t.enregistre);
        // La pastille relit son seuil sans qu'on ait à recharger la page.
        window.dispatchEvent(new Event("wow-dette-changee"));
      } else {
        setMsg(t.erreur);
      }
    } catch {
      setMsg(t.erreur);
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  }

  return (
    <div className="lol-panel p-4" style={{ marginTop: 24 }}>
      <h2 style={{
        fontFamily: "var(--font-heading)",
        fontSize: "1rem",
        color: "var(--amber)",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        marginBottom: 6,
      }}>
        {t.titre}
      </h2>
      <p style={{ fontSize: "0.8rem", color: "rgba(236,239,244,0.5)", marginBottom: 14, lineHeight: 1.6 }}>
        {t.description}
      </p>

      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-xs mb-1" style={{ color: "rgba(152,162,176,0.7)" }}>
            {t.label}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number" min="0" max={MAX_MIN}
              className="lol-input text-center" style={{ width: 84 }}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            <span className="text-sm" style={{ color: "rgba(236,239,244,0.5)" }}>{t.minutes}</span>
            <input
              type="number" min="0" max="59"
              className="lol-input text-center" style={{ width: 84 }}
              value={secondes}
              onChange={(e) => setSecondes(e.target.value)}
            />
            <span className="text-sm" style={{ color: "rgba(236,239,244,0.5)" }}>{t.secondes}</span>
          </div>
        </div>

        <button className="lol-btn text-sm px-5" onClick={enregistrer} disabled={saving}>
          {saving ? t.enregistrement : t.enregistrer}
        </button>

        {actuelSec !== null && (
          <span className="text-xs" style={{ color: "rgba(152,162,176,0.6)" }}>
            {t.actuel(lisible(actuelSec))}
            {seuilSec !== null && seuilSec > 0 && ` · ${t.seuilRappel(lisible(seuilSec))}`}
          </span>
        )}
      </div>

      <p className="text-xs mt-3" style={{ color: "rgba(236,239,244,0.35)" }}>
        {sansExercice ? t.sansExercice : t.desactive}
      </p>
      {msg && (
        <p className="text-sm mt-2" style={{ color: msg === t.enregistre ? "var(--victory)" : "var(--ember)" }}>
          {msg}
        </p>
      )}
    </div>
  );
}
