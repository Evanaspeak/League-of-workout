"use client";
import { useEffect, useState } from "react";
import { useT, useDateLocale } from "@/lib/i18n/LocaleContext";
import { adminRatios } from "@/lib/i18n/dictionaries/adminRatios";
import {
  RATIOS_DEFAUT, RATIO_BORNES, formaterDuree, type ExerciceId,
} from "@/lib/exercices";

/** Dette d'exemple, en points d'effort : une défaite ordinaire. */
const EXEMPLE = 38;

/**
 * Réglage des ratios entre exercices.
 *
 * Le scoring produit des points d'effort ; chaque exercice dit combien
 * d'unités coûte un point. Ce panneau ne touche pas au scoring, seulement à
 * cette conversion — une défaite reste aussi chère, elle se paie simplement
 * dans une autre monnaie.
 */
export default function AdminRatiosExercices() {
  const t = useT(adminRatios);
  const etiquette = useDateLocale();

  const [squats, setSquats] = useState(String(RATIOS_DEFAUT.squats));
  const [boxe, setBoxe] = useState(String(RATIOS_DEFAUT.boxe));
  const [parDefaut, setParDefaut] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  /**
   * A-t-on VRAIMENT lu les valeurs en vigueur ?
   *
   * Les champs partent sur `RATIOS_DEFAUT`, ce qu'il faut bien afficher le
   * temps de la requête. Mais une lecture qui échoue laissait ces valeurs à
   * l'écran **comme si c'était la configuration du site** — et un seul clic
   * sur « Enregistrer » écrasait alors les vrais ratios par les valeurs
   * d'origine. Ce panneau règle une conversion GLOBALE : ce que doit tout le
   * monde s'exprimerait d'un coup dans une autre unité, sans que personne
   * l'ait demandé, et le seul indice serait un chiffre qui a changé.
   *
   * On n'écrit donc pas une valeur qu'on n'a pas lue. C'est la règle du repli
   * déjà écrite pour les réglages : un repli ne peut pas être plus permissif
   * que ce qu'on demandait.
   */
  const [lu, setLu] = useState(false);
  const [lectureKO, setLectureKO] = useState(false);

  useEffect(() => {
    fetch("/api/admin/config/exercices")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.ratios) { setLectureKO(true); return; }
        setSquats(String(d.ratios.squats));
        setBoxe(String(d.ratios.boxe));
        setParDefaut(Boolean(d.parDefaut));
        setLu(true);
      })
      .catch(() => setLectureKO(true));
  }, []);

  /** Valeur saisie ramenée dans ses bornes, pour l'aperçu comme pour l'envoi. */
  const borne = (v: string, id: ExerciceId) => {
    const n = Number(v);
    const { min, max } = RATIO_BORNES[id];
    if (!Number.isFinite(n)) return RATIOS_DEFAUT[id];
    return Math.min(max, Math.max(min, n));
  };

  const rSquats = borne(squats, "squats");
  const rBoxe = borne(boxe, "boxe");

  async function envoyer(methode: "PUT" | "DELETE") {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/admin/config/exercices", {
        method: methode,
        headers: methode === "PUT" ? { "Content-Type": "application/json" } : undefined,
        body: methode === "PUT"
          ? JSON.stringify({ ratios: { squats: rSquats, boxe: rBoxe } })
          : undefined,
      });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setSquats(String(d.ratios.squats));
      setBoxe(String(d.ratios.boxe));
      setParDefaut(methode === "DELETE");
      setMsg(t.enregistre);
    } catch {
      setMsg(t.erreur);
    }
    setSaving(false);
    setTimeout(() => setMsg(""), 3000);
  }

  const ligne = (
    label: string,
    unite: string,
    id: ExerciceId,
    valeur: string,
    set: (v: string) => void,
  ) => {
    const { min, max } = RATIO_BORNES[id];
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm" style={{ color: "var(--steel)", minWidth: 110 }}>{label}</span>
        <input
          type="number" min={min} max={max} step="0.5"
          className="lol-input text-center" style={{ width: 90 }}
          value={valeur}
          onChange={(e) => set(e.target.value)}
          aria-label={`${label} ${unite}`}
        />
        <span className="text-sm" style={{ color: "var(--faint)" }}>{unite}</span>
        <span className="text-xs" style={{ color: "var(--faint)" }}>{t.borne(min, max)}</span>
      </div>
    );
  };

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
      <p style={{ fontSize: "0.8rem", color: "var(--faint)", marginBottom: 14, lineHeight: 1.6 }}>
        {t.description}
      </p>

      <div className="flex flex-col gap-3">
        <div>
          <div className="text-sm" style={{ color: "var(--bone)" }}>{t.reference}</div>
          <div className="text-xs mt-1" style={{ color: "var(--faint)", lineHeight: 1.5 }}>
            {t.referenceNote}
          </div>
        </div>
        {ligne(t.squatsLabel, t.squatsUnite, "squats", squats, setSquats)}
        {ligne(t.boxeLabel, t.boxeUnite, "boxe", boxe, setBoxe)}
      </div>

      <div style={{
        marginTop: 16,
        paddingTop: 14,
        borderTop: "1px solid var(--line)",
      }}>
        <div className="text-xs mb-2" style={{ color: "var(--steel)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {t.apercuTitre}
        </div>
        <div className="flex gap-5 flex-wrap text-sm" style={{ color: "var(--bone)" }}>
          <span>{EXEMPLE} {t.pompesUnite}</span>
          <span>{Math.round(EXEMPLE * rSquats)} {t.squatsUnite}</span>
          <span>{formaterDuree(Math.round((EXEMPLE * rBoxe) / 5) * 5, etiquette)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 16 }}>
        <button
          className="lol-btn text-sm px-5"
          onClick={() => envoyer("PUT")}
          disabled={saving || !lu}
          style={{ opacity: lu ? 1 : 0.45 }}
        >
          {saving ? t.enregistrement : t.enregistrer}
        </button>
        <button
          className="lol-btn lol-btn-blue text-sm px-4"
          onClick={() => envoyer("DELETE")}
          disabled={saving || parDefaut || !lu}
          style={{ opacity: parDefaut || !lu ? 0.45 : 1 }}
        >
          {t.reinitialiser}
        </button>
        <span className="text-xs" style={{ color: "var(--steel)" }}>
          {parDefaut ? t.parDefaut : t.personnalise}
        </span>
      </div>

      <p className="text-xs mt-3" style={{ color: "var(--faint)" }}>{t.propagation}</p>

      {/*
        L'échec de lecture se DIT, et il s'annonce : sans `role`, il paraît à
        l'écran et n'existe pas pour un lecteur d'écran — sous deux boutons
        devenus inertes, ce qui est exactement l'expérience du refus silencieux.
      */}
      {lectureKO && (
        <p role="alert" className="text-sm mt-2" style={{ color: "var(--ember)" }}>
          {t.lectureEchouee}
        </p>
      )}

      {msg && (
        <p className="text-sm mt-2" style={{ color: msg === t.enregistre ? "var(--victory)" : "var(--ember)" }}>
          {msg}
        </p>
      )}
    </div>
  );
}
