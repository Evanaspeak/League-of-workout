"use client";
import { useEffect, useState } from "react";
import { useT, useDateLocale } from "@/lib/i18n/LocaleContext";
import { consentementSante as dict } from "@/lib/i18n/dictionaries/consentementSante";

type Etat = "jamais" | "accepte" | "refuse";
type Mesures = {
  genre: string; age: string; poids: string; taille: string; sportsHoursPerWeek: string;
};

const VIDE: Mesures = { genre: "", age: "", poids: "", taille: "", sportsHoursPerWeek: "" };

/**
 * Les mesures physiques, modifiables — ce qui n'a jamais été le cas.
 *
 * Elles étaient saisies à l'inscription puis figées à vie : quelqu'un qui perd
 * huit kilos gardait son ancien poids, et le droit de rectification n'avait
 * aucun chemin dans l'application.
 *
 * Le bloc se lit lui-même plutôt que de passer par l'état de la page des
 * réglages : il porte une question de consentement, et cette question doit
 * pouvoir changer de réponse sans recharger le reste.
 */
export function MesuresPhysiques() {
  const t = useT(dict);
  const etiquette = useDateLocale();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [depuis, setDepuis] = useState<string | null>(null);
  const [form, setForm] = useState<Mesures>(VIDE);
  const [enregistrement, setEnregistrement] = useState(false);
  const [enregistre, setEnregistre] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const relire = () => Promise.all([
    fetch("/api/consentement").then((r) => (r.ok ? r.json() : null)),
    fetch("/api/settings").then((r) => (r.ok ? r.json() : null)),
  ]).then(([c, s]) => {
    if (c) { setEtat(c.etat as Etat); setDepuis(c.depuis ?? null); }
    const u = s?.user;
    if (u) {
      setForm({
        genre: u.genre ?? "",
        age: u.age == null ? "" : String(u.age),
        poids: u.poids == null ? "" : String(u.poids),
        taille: u.taille == null ? "" : String(u.taille),
        sportsHoursPerWeek: u.sportsHoursPerWeek == null ? "" : String(u.sportsHoursPerWeek),
      });
    }
  }).catch(() => {});

  useEffect(() => { void relire(); }, []);

  if (etat === null) return null;

  const dateLisible = depuis
    ? new Intl.DateTimeFormat(etiquette, { dateStyle: "long" }).format(new Date(depuis))
    : "";

  const consentir = async (accepte: boolean) => {
    if (!accepte && !window.confirm(t.retirerConfirme)) return;
    await fetch("/api/consentement", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepte }),
    });
    if (!accepte) setForm(VIDE);
    await relire();
  };

  const enregistrer = async () => {
    setEnregistrement(true); setErreur(null); setEnregistre(false);
    try {
      // Une case laissée vide efface le champ : c'est un droit, et il ne doit
      // pas obliger à retirer le consentement pour tout le reste.
      const userPrefs: Record<string, unknown> = {
        genre: form.genre === "" ? null : form.genre,
        age: form.age === "" ? null : Number(form.age),
        poids: form.poids === "" ? null : Number(form.poids),
        taille: form.taille === "" ? null : Number(form.taille),
        sportsHoursPerWeek: form.sportsHoursPerWeek === "" ? null : Number(form.sportsHoursPerWeek),
      };
      const r = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userPrefs }),
      });
      if (r.ok) { setEnregistre(true); setTimeout(() => setEnregistre(false), 2500); }
      else setErreur(r.status === 400 ? t.horsBornes : t.echec);
    } catch {
      setErreur(t.echec);
    } finally {
      setEnregistrement(false);
    }
  };

  const champ = (
    cle: keyof Mesures, libelle: string, min: number, max: number,
  ) => (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor={`mesure-${cle}`}>
        {libelle}
      </label>
      <input
        id={`mesure-${cle}`}
        type="number" min={min} max={max} className="lol-input"
        value={form[cle]}
        onChange={(e) => setForm((f) => ({ ...f, [cle]: e.target.value }))}
      />
    </div>
  );

  return (
    <div className="lol-panel p-5 space-y-4">
      <div>
        <h2 className="titre-section">{t.blocTitre}</h2>
        <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.blocSousTitre}</p>
      </div>

      {etat === "accepte" ? (
        <>
          <p className="text-xs" style={{ color: "var(--steel)" }}>{t.consentiLe(dateLisible)}</p>

          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor="mesure-genre">
              {t.genre}
            </label>
            <select
              id="mesure-genre" className="lol-select"
              value={form.genre}
              onChange={(e) => setForm((f) => ({ ...f, genre: e.target.value }))}
            >
              <option value="">—</option>
              {(Object.keys(t.genreOptions) as (keyof typeof t.genreOptions)[]).map((cle) => (
                <option key={cle} value={cle}>{t.genreOptions[cle]}</option>
              ))}
            </select>
            <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.genreAide}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {champ("age", t.age, 13, 99)}
            {champ("poids", t.poids, 30, 300)}
            {champ("taille", t.taille, 100, 250)}
            {champ("sportsHoursPerWeek", t.sport, 0, 40)}
          </div>

          {erreur && <p className="text-sm loss-text">{erreur}</p>}

          <button className="lol-btn w-full" onClick={enregistrer} disabled={enregistrement}>
            {enregistrement ? t.enCours : enregistre ? t.enregistre : t.enregistrer}
          </button>
          <button
            type="button"
            className="text-xs"
            onClick={() => consentir(false)}
            style={{ color: "var(--steel)", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            {t.retirer}
          </button>
        </>
      ) : (
        <>
          {etat === "refuse" && (
            <p className="text-xs" style={{ color: "var(--steel)" }}>{t.refuseLe(dateLisible)}</p>
          )}
          <p style={{ color: "var(--muted)", fontSize: "0.85rem", lineHeight: 1.6 }}>
            {t.introSansDonnees}
          </p>
          <button className="lol-btn w-full" onClick={() => consentir(true)}>
            {t.redemander}
          </button>
        </>
      )}
    </div>
  );
}
