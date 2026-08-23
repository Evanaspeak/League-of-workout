"use client";
import { useMemo, useState } from "react";
import { useT, useDateLocale } from "@/lib/i18n/LocaleContext";
import { correctionDates as dict } from "@/lib/i18n/dictionaries/correctionDates";
import { jourLocal } from "@/lib/serie";

/**
 * Corriger la date de toute une soirée d'un coup.
 *
 * Un défaut corrigé depuis datait du jour de la saisie les parties ajoutées à
 * la main dans le passé. Les statistiques par période s'en trouvent fausses sur
 * toutes les parties rattrapées, et les reprendre une par une n'est pas un
 * travail qu'on demande à quelqu'un.
 *
 * L'outil part d'un JOUR plutôt que d'une sélection à cocher : c'est ainsi que
 * le défaut se manifeste — une soirée entière collée sur la même date.
 */
export function CorrectionDates({
  parties, surCorrection,
}: {
  parties: { id: string; date: string }[];
  surCorrection: () => void;
}) {
  const t = useT(dict);
  const etiquette = useDateLocale();
  const [ouvert, setOuvert] = useState(false);
  const [jour, setJour] = useState(jourLocal());
  const [geste, setGeste] = useState<"decaler" | "poser">("decaler");
  const [jours, setJours] = useState(-1);
  const [heures, setHeures] = useState(0);
  const [nouvelleDate, setNouvelleDate] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const concernees = useMemo(
    // Le jour se compare en local : une partie de 23 h 40 appartient au jour
    // qu'a vécu la personne, pas au lendemain UTC.
    () => parties.filter((p) => jourLocal(new Date(p.date)) === jour),
    [parties, jour],
  );

  const decalageMinutes = jours * 24 * 60 + heures * 60;

  const apercu = useMemo(() => {
    if (concernees.length === 0) return null;
    const premiere = new Date(concernees[0].date);
    const apres = geste === "poser" && nouvelleDate
      ? new Date(nouvelleDate)
      : new Date(premiere.getTime() + decalageMinutes * 60_000);
    if (Number.isNaN(apres.getTime())) return null;
    const format = new Intl.DateTimeFormat(etiquette, { dateStyle: "short", timeStyle: "short" });
    return `${format.format(premiere)} → ${format.format(apres)}`;
  }, [concernees, geste, nouvelleDate, decalageMinutes, etiquette]);

  const appliquer = async () => {
    if (concernees.length === 0) return;
    setEnCours(true); setMessage(null);
    try {
      const corps = geste === "poser"
        ? { ids: concernees.map((p) => p.id), date: new Date(nouvelleDate).toISOString() }
        : { ids: concernees.map((p) => p.id), decalageMinutes };
      const r = await fetch("/api/games/dates", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corps),
      });
      if (!r.ok) { setMessage(t.echec); return; }
      const { corrigees } = await r.json();
      setMessage(t.fait(corrigees));
      surCorrection();
    } catch {
      setMessage(t.echec);
    } finally {
      setEnCours(false);
    }
  };

  if (!ouvert) {
    return (
      <button
        type="button"
        onClick={() => setOuvert(true)}
        className="text-xs"
        style={{
          color: "var(--steel)", background: "none", border: "none",
          cursor: "pointer", padding: 0, textDecoration: "underline",
        }}
      >
        {t.ouvrir}
      </button>
    );
  }

  return (
    <div className="lol-panel p-5 space-y-4">
      <div>
        <h2 className="titre-section">{t.titre}</h2>
        <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.aide}</p>
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor="corr-jour">
          {t.jour}
        </label>
        <input
          id="corr-jour" type="date" className="lol-input"
          value={jour} onChange={(e) => setJour(e.target.value)}
        />
        <p className="text-xs mt-1" style={{ color: concernees.length ? "var(--gold)" : "var(--steel)" }}>
          {concernees.length ? t.trouvees(concernees.length) : t.aucune}
        </p>
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor="corr-geste">
          {t.geste}
        </label>
        <select
          id="corr-geste" className="lol-select" value={geste}
          onChange={(e) => setGeste(e.target.value === "poser" ? "poser" : "decaler")}
        >
          <option value="decaler">{t.decaler}</option>
          <option value="poser">{t.poser}</option>
        </select>
      </div>

      {geste === "decaler" ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor="corr-jours">
              {t.jours}
            </label>
            <input
              id="corr-jours" type="number" min={-365} max={365} className="lol-input"
              value={jours}
              onChange={(e) => setJours(Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor="corr-heures">
              {t.heures}
            </label>
            <input
              id="corr-heures" type="number" min={-23} max={23} className="lol-input"
              value={heures}
              onChange={(e) => setHeures(Number(e.target.value) || 0)}
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor="corr-date">
            {t.nouvelleDate}
          </label>
          <input
            id="corr-date" type="datetime-local" className="lol-input"
            value={nouvelleDate} onChange={(e) => setNouvelleDate(e.target.value)}
          />
        </div>
      )}

      {apercu && (
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {t.apercu} : {apercu}
        </p>
      )}
      <p className="text-xs" style={{ color: "var(--steel)" }}>{t.avertissement}</p>
      {message && <p className="text-sm" style={{ color: "var(--gold)" }}>{message}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          className="lol-btn"
          style={{ flex: "1 1 10rem" }}
          disabled={enCours || concernees.length === 0 || (geste === "decaler" ? decalageMinutes === 0 : !nouvelleDate)}
          onClick={appliquer}
        >
          {enCours ? t.enCours : t.appliquer}
        </button>
        <button
          className="lol-btn"
          style={{ flex: "1 1 10rem", background: "transparent" }}
          onClick={() => setOuvert(false)}
        >
          {t.fermer}
        </button>
      </div>
    </div>
  );
}
