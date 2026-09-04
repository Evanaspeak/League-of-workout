"use client";
import { useMemo, useState } from "react";
import { Lien } from "@/components/Lien";
import { useT, useNombre } from "@/lib/i18n/LocaleContext";
import { calculateur as dict } from "@/lib/i18n/dictionaries/calculateur";
import { calculerPublic } from "@/lib/calculateurPublic";
import { capacitesDuJeu, typeDuJeu } from "@/lib/jeux";
import { ROLES_DEFAUT } from "@/lib/scoringDefaut";

/**
 * Le calculateur d'une page publique.
 *
 * Tout se passe dans le navigateur : aucune requête, aucun compte, aucune
 * trace. Quelqu'un arrivé par une recherche obtient sa réponse avant qu'on lui
 * demande quoi que ce soit — c'est la condition pour qu'il reste.
 */
export function Calculateur({ jeu }: { jeu: string }) {
  const t = useT(dict);
  /**
   * Une décimale, et elle passe par `Intl`.
   *
   * `${n}` rend « 24.7 » dans les six langues. Le français et
   * l'espagnol écrivent « 24,7 », et en allemand le POINT est le
   * séparateur des milliers : « 24.7 » s'y lit comme vingt-quatre mille
   * sept. Ce n'est pas de la typographie, c'est un chiffre faux.
   */
  const decimal = useNombre({ maximumFractionDigits: 1 });
  const capacites = useMemo(() => capacitesDuJeu(jeu), [jeu]);
  const type = useMemo(() => typeDuJeu(jeu), [jeu]);

  const [pompesMax, setPompesMax] = useState(15);
  const [role, setRole] = useState("Mid");
  const [result, setResult] = useState<"V" | "D">("D");
  const [kills, setKills] = useState(2);
  const [deaths, setDeaths] = useState(7);
  const [assists, setAssists] = useState(5);
  const [arrets, setArrets] = useState(1);
  const [placement, setPlacement] = useState(8);
  const [minutes, setMinutes] = useState(60);

  const resultat = useMemo(() => calculerPublic({
    jeu, pompesMax, role, result,
    kills, deaths, assists, arrets,
    placement, joueurs: capacites.joueurs,
    dureeSec: minutes * 60,
  }), [jeu, pompesMax, role, result, kills, deaths, assists, arrets, placement, minutes, capacites.joueurs]);

  const nombre = (
    id: string, libelle: string, valeur: number,
    poser: (n: number) => void, min: number, max: number,
  ) => (
    <div>
      <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor={id}>
        {libelle}
      </label>
      <input
        id={id} type="number" min={min} max={max} className="lol-input"
        value={valeur}
        onChange={(e) => {
          const n = Number(e.target.value);
          // Une saisie vide rend NaN : la garder ferait disparaître le résultat
          // le temps d'effacer un chiffre pour en écrire un autre.
          poser(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min);
        }}
      />
    </div>
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="lol-panel p-5 flex flex-col gap-4">
        <div>
          {nombre("force", t.force, pompesMax, setPompesMax, 0, 200)}
          <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.forceAide}</p>
        </div>

        {capacites.roles && (
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor="role">
              {t.role}
            </label>
            <select id="role" className="lol-select" value={role} onChange={(e) => setRole(e.target.value)}>
              {ROLES_DEFAUT.map((r) => <option key={r.role} value={r.role}>{r.role}</option>)}
            </select>
          </div>
        )}

        {type !== "temps" && !capacites.br && (
          <div>
            <label className="block text-xs mb-1" style={{ color: "var(--steel)" }} htmlFor="resultat">
              {t.resultat}
            </label>
            <select
              id="resultat" className="lol-select" value={result}
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

        {type === "temps" && nombre("duree", t.duree, minutes, setMinutes, 0, 1440)}
      </div>

      <div
        className="lol-panel p-5"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
      >
        {resultat.points === 0 ? (
          <p style={{ color: "var(--muted)" }}>{t.rien}</p>
        ) : (
          <>
            <span style={{ fontSize: "0.75rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--steel)" }}>
              {t.verdict}
            </span>
            <strong style={{
              fontFamily: "var(--font-heading)", fontSize: "clamp(2.4rem, 9vw, 3.6rem)",
              lineHeight: 1, color: "var(--gold)",
            }}>
              {resultat.points}
            </strong>
            <span style={{ color: "var(--muted)" }}>{t.unite}</span>
          </>
        )}
        <span className="text-xs" style={{ color: "var(--steel)" }}>
          {t.niveau(resultat.niveau)} · {t.multiplicateur(decimal(resultat.multiplicateur))}
        </span>
      </div>

      <div className="lol-panel p-5 flex flex-col gap-3">
        <h2 className="titre-section">{t.appelTitre}</h2>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.6 }}>{t.appel}</p>
        <Lien href="/beta" className="lol-btn" style={{ textAlign: "center" }}>{t.bouton}</Lien>
        <p className="text-xs" style={{ color: "var(--steel)" }}>{t.avertissement}</p>
      </div>
    </div>
  );
}
