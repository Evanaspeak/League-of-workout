"use client";
import { useT } from "@/lib/i18n/LocaleContext";
import { jeux as jeuxDict } from "@/lib/i18n/dictionaries/jeux";

/** Affichage d'horloge : 01:24:07 au-delà d'une heure, 24:07 en dessous. */
export function formaterChrono(totalSecondes: number): string {
  const s = Math.max(0, Math.floor(totalSecondes));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/**
 * Les deux compteurs partagent la même taille, qui s'adapte à la largeur de
 * l'écran : « 4 min 40 » ne doit pas passer à la ligne sur un téléphone.
 */
const VALEUR_STYLE: React.CSSProperties = {
  color: "#ECEFF4",
  fontVariantNumeric: "tabular-nums",
  fontSize: "clamp(1.35rem, 6.5vw, 1.875rem)",
  lineHeight: 1.15,
  whiteSpace: "nowrap",
};

/**
 * Panneau d'une session chronométrée : pour les jeux sans victoire ni défaite,
 * il n'y a pas de partie à suivre, c'est le temps passé à jouer qui fabrique
 * la dette. On montre donc le temps qui court et la dette qui monte avec.
 */
export function SessionChrono({
  jeu, niveau, chronoSec, dette, erreur,
  enregistrement, onArreter, onAnnuler,
}: {
  jeu: string;
  niveau: string;
  chronoSec: number;
  /** Dette en cours, déjà convertie dans l'unité de l'exercice. */
  dette: string;
  /** Code d'erreur remonté par le contexte : "court" | "erreur" | "". */
  erreur: string;
  enregistrement: boolean;
  onArreter: () => void;
  onAnnuler: () => void;
}) {
  const t = useT(jeuxDict);

  return (
    <div className="space-y-3">
      <div
        className="flex items-center gap-2 p-3 rounded flex-wrap"
        style={{ background: "rgba(110,155,255,0.08)", border: "1px solid rgba(110,155,255,0.3)" }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ background: "var(--signal)", boxShadow: "0 0 6px var(--signal)", animation: "pulse 1.5s infinite" }}
        />
        <span className="text-sm font-semibold" style={{ color: "var(--signal)" }}>{t.chronoEnCours}</span>
        <span className="text-xs gold-text">{jeu}</span>
        <span className="ml-auto text-xs" style={{ color: "var(--faint)" }}>
          {niveau}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="lol-panel p-4 text-center" style={{ background: "rgba(152,162,176,0.06)" }}>
          <div className="mono-num font-bold" style={VALEUR_STYLE}>
            {formaterChrono(chronoSec)}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.chronoEcoule}</div>
        </div>
        <div className="lol-panel p-4 text-center" style={{ background: "rgba(152,162,176,0.06)" }}>
          <div className="mono-num font-bold gold-text" style={{ ...VALEUR_STYLE, color: undefined }}>{dette}</div>
          <div className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.chronoDette}</div>
        </div>
      </div>

      <p className="text-xs text-center" style={{ color: "var(--faint)" }}>
        {t.chronoSousTitre}
      </p>

      {erreur && (
        <p className="text-sm loss-text text-center">
          {erreur === "court" ? t.chronoTropCourt : t.chronoErreur}
        </p>
      )}

      <div className="flex gap-2">
        <button
          className="py-2 px-4 rounded text-sm"
          style={{
            background: "rgba(152,162,176,0.1)",
            color: "var(--muted)",
            border: "1px solid rgba(152,162,176,0.2)",
          }}
          onClick={onAnnuler}
        >
          {t.chronoAnnuler}
        </button>
        <button className="lol-btn flex-1" onClick={onArreter} disabled={enregistrement}>
          {enregistrement ? t.chronoEnregistrement : t.chronoArreter}
        </button>
      </div>
    </div>
  );
}
