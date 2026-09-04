"use client";
import { ROLES } from "@/lib/scoringDefaut";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useT, useDateLocale } from "@/lib/i18n/LocaleContext";
import { simulateur as dict } from "@/lib/i18n/dictionaries/simulateur";
import { capacitesDuJeu, JEUX, typeDuJeu, type TypeJeu } from "@/lib/jeux";
import { ventiler, type Repartition } from "@/lib/exercices";

/**
 * Ce qu'une partie coûterait, sans avoir à la perdre.
 *
 * Le calcul passe par l'aperçu de scoring — la même route que l'enregistrement
 * réel. C'est délibéré : un simulateur qui referait le calcul de son côté
 * finirait par annoncer autre chose que ce qui est écrit, et un simulateur qui
 * ment est pire qu'aucun simulateur. La règle vaut aussi pour la surcharge de
 * maîtrise et les poids de rôle, que seul le serveur connaît.
 */
type Apercu = {
  scoring: { pompesFinales: number; niveau: number; remake?: boolean };
  repartition: Repartition;
};

export function SimulateurDette() {
  const t = useT(dict);
  const etiquette = useDateLocale();

  const [jeu, setJeu] = useState("League of Legends");
  const [role, setRole] = useState("Mid");
  const [result, setResult] = useState<"V" | "D">("D");
  const [kills, setKills] = useState(2);
  const [deaths, setDeaths] = useState(9);
  const [assists, setAssists] = useState(4);
  const [arrets, setArrets] = useState(1);
  const [placement, setPlacement] = useState(8);
  const [minutes, setMinutes] = useState(28);
  const [classee, setClassee] = useState(false);

  const [apercu, setApercu] = useState<Apercu | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState(false);

  const capacites = useMemo(() => capacitesDuJeu(jeu), [jeu]);
  const type = useMemo<TypeJeu>(() => typeDuJeu(jeu), [jeu]);

  const calculer = useCallback(async () => {
    setEnCours(true); setErreur(false);
    try {
      const r = await fetch("/api/games/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jeu, typeJeu: type, role, result,
          kills, deaths, assists, arrets,
          placement, joueurs: capacites.joueurs,
          dureeSec: minutes * 60,
          fileClassee: classee,
        }),
      });
      if (!r.ok) { setErreur(true); return; }
      setApercu(await r.json());
    } catch {
      setErreur(true);
    } finally {
      setEnCours(false);
    }
  }, [jeu, type, role, result, kills, deaths, assists, arrets, placement, minutes, classee, capacites.joueurs]);

  // Le calcul se relance à chaque changement, avec un temps mort : sans lui,
  // taper « 12 » dans un champ déclencherait deux requêtes.
  useEffect(() => {
    const minuteur = setTimeout(() => { void calculer(); }, 350);
    return () => clearTimeout(minuteur);
  }, [calculer]);

  const nombre = (
    id: string, libelle: string, valeur: number,
    poser: (n: number) => void, min: number, max: number,
  ) => (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor={`sim-${id}`}>
        {libelle}
      </label>
      <input
        id={`sim-${id}`} type="number" min={min} max={max} className="lol-input"
        value={valeur}
        onChange={(e) => {
          const n = Number(e.target.value);
          poser(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
        }}
      />
    </div>
  );

  const lignes = apercu ? ventiler(apercu.repartition ?? {}, null, etiquette) : [];

  return (
    <div className="lol-panel p-5 space-y-4">
      <div>
        <h2 className="titre-section">{t.titre}</h2>
        <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.aide}</p>
      </div>

      <div>
        <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor="sim-jeu">
          {t.jeu}
        </label>
        <select id="sim-jeu" className="lol-select" value={jeu} onChange={(e) => setJeu(e.target.value)}>
          {JEUX.map((j) => <option key={j.nom} value={j.nom}>{j.nom}</option>)}
        </select>
      </div>

      {capacites.roles && (
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor="sim-role">
            {t.role}
          </label>
          <select id="sim-role" className="lol-select" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {type !== "temps" && !capacites.br && (
        <div>
          <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor="sim-resultat">
            {t.resultat}
          </label>
          <select
            id="sim-resultat" className="lol-select" value={result}
            onChange={(e) => setResult(e.target.value === "V" ? "V" : "D")}
          >
            <option value="D">{t.defaite}</option>
            <option value="V">{t.victoire}</option>
          </select>
        </div>
      )}

      {capacites.kda && (
        <div className="grid grid-cols-3 gap-3">
          {nombre("kills", t.kills, kills, setKills, 0, 99)}
          {nombre("deaths", t.deaths, deaths, setDeaths, 0, 99)}
          {nombre("assists", t.assists, assists, setAssists, 0, 99)}
        </div>
      )}

      {capacites.rl && (
        <div className="grid grid-cols-3 gap-3">
          {nombre("buts", t.buts, kills, setKills, 0, 99)}
          {nombre("arrets", t.arrets, arrets, setArrets, 0, 99)}
          {nombre("passes", t.passes, assists, setAssists, 0, 99)}
        </div>
      )}

      {capacites.br && (
        <div className="grid grid-cols-2 gap-3">
          {nombre("placement", t.placement, placement, setPlacement, 1, capacites.joueurs)}
          {nombre("kills-br", t.kills, kills, setKills, 0, 99)}
        </div>
      )}

      {nombre("duree", t.duree, minutes, setMinutes, 0, 240)}

      {type !== "temps" && (
        <label className="flex items-center gap-2 text-sm" style={{ cursor: "pointer" }}>
          <input type="checkbox" checked={classee} onChange={(e) => setClassee(e.target.checked)} />
          {t.classee}
        </label>
      )}

      <div style={{
        borderTop: "1px solid var(--line)", paddingTop: 12,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
      }}>
        {erreur && <p className="text-sm loss-text">{t.echec}</p>}
        {!erreur && enCours && !apercu && (
          <p className="text-sm" style={{ color: "var(--steel)" }}>{t.calcul}</p>
        )}
        {!erreur && apercu && (
          apercu.scoring.remake ? (
            <p style={{ color: "var(--muted)" }}>{t.remake}</p>
          ) : lignes.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>{t.rien}</p>
          ) : (
            <>
              <span style={{
                fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase",
                color: "var(--steel)",
              }}>
                {t.verdict}
              </span>
              <strong style={{
                fontFamily: "var(--font-heading)", fontSize: "1.8rem",
                color: "var(--gold)", fontVariantNumeric: "tabular-nums",
              }}>
                {lignes.map((l) => l.valeur).join(" · ")}
              </strong>
              <span className="text-xs" style={{ color: "var(--steel)" }}>
                {t.detail(apercu.scoring.niveau)}
              </span>
            </>
          )
        )}
      </div>
    </div>
  );
}
