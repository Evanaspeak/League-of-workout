"use client";
import { useState } from "react";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { amis as dictAmis } from "@/lib/i18n/dictionaries/amis";
import { translateApiError } from "@/lib/i18n/apiErrors";
import { jourLocal } from "@/lib/serie";
import type { DetteEquipe as Etat } from "@/lib/detteGroupe";

/**
 * La dette commune d'une équipe, sur la carte d'un groupe.
 *
 * Elle ne s'ouvre qu'à la demande : une carte de groupe qui irait chercher la
 * dette de chacun au chargement ferait un appel par groupe, sur un écran qui
 * en montre jusqu'à dix.
 *
 * **Rien ici ne désigne le meilleur payeur.** La réponse 117 refusait le duel
 * — « celui qui paie le plus gagne » — parce que « ça incite au mauvaise
 * performance », et on paie ce qu'on a perdu. L'écran montre ce qui est DÛ ;
 * la personne en tête est celle qu'on vient aider, pas celle qui gagne.
 */
/**
 * Une part qui n'est ni un entier, ni positive, ni sous la dette de l'autre ne
 * s'envoie pas : le serveur la refuserait, et le message accuserait la saisie
 * de quelqu'un qui a rempli ce qu'on lui demandait.
 */
function partValide(brut: string, du: number): boolean {
  const n = Number(brut);
  return Number.isInteger(n) && n > 0 && n <= du;
}

export default function DetteEquipe(
  { groupeId, nom }: { groupeId: string; nom: string },
) {
  const t = useT(dictAmis);
  const { locale } = useLocale();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const [occupe, setOccupe] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  /**
   * La part qu'on prend, par membre.
   *
   * Un nombre figé — dix points, disons — obligerait à cliquer vingt fois pour
   * solder une dette de deux cents, et c'est précisément la personne qu'on
   * vient aider qui en a une grosse.
   */
  const [parts, setParts] = useState<Record<string, string>>({});

  const charger = async () => {
    setErreur("");
    try {
      const res = await fetch(`/api/groupes/${groupeId}/dette`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data?.error ? translateApiError(String(data.error), locale) : t.erreur);
        return;
      }
      setEtat(data as Etat);
    } catch {
      setErreur(t.erreurAction);
    }
  };

  const ouvrir = async () => {
    setOuvert(true);
    if (!etat) await charger();
  };

  /**
   * Prendre une part de la dette d'un coéquipier.
   *
   * L'état n'est PAS posé avant la réponse : c'est le défaut déjà corrigé
   * trois fois sur ce projet — un écran qui affiche ce que le serveur n'a pas
   * gardé. Ici il coûterait plus cher qu'ailleurs, puisqu'il annoncerait à
   * quelqu'un que sa dette a baissé alors qu'elle est intacte.
   */
  const relayer = async (membre: string, points: number) => {
    setOccupe(membre);
    setErreur("");
    try {
      const res = await fetch(`/api/groupes/${groupeId}/dette`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ membre, points, jour: jourLocal(), jeton: crypto.randomUUID() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data?.error ? translateApiError(String(data.error), locale) : t.erreurAction);
        return;
      }
      setEtat(data as Etat);
      // La dette de quelqu'un vient de bouger : le compteur du rail et le
      // titre de l'onglet écoutent cet événement.
      window.dispatchEvent(new Event("wow-dette-changee"));
    } catch {
      setErreur(t.erreurAction);
    } finally {
      setOccupe(null);
    }
  };

  if (!ouvert) {
    return (
      <button type="button" className="lol-btn" onClick={ouvrir} aria-label={`${t.equipeVoir} ${nom}`}>
        {t.equipeVoir}
      </button>
    );
  }

  return (
    <div className="space-y-2" style={{ borderLeft: "2px solid var(--line)", paddingLeft: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <strong style={{ color: "var(--gold)" }}>{t.equipeTitre}</strong>
        {etat && <span className="mono-num">{t.equipeTotal(etat.total)}</span>}
      </div>
      <p style={{ color: "var(--steel)", fontSize: ".85rem", maxWidth: "60ch" }}>{t.equipeAide}</p>

      {erreur && (
        <p role="alert" style={{ color: "var(--loss)", fontSize: ".9rem" }}>{erreur}</p>
      )}

      {etat === null ? (
        <p style={{ color: "var(--steel)" }}>{t.chargement}</p>
      ) : (
        <>
          <ul className="space-y-1" style={{ listStyle: "none", padding: 0 }}>
            {etat.lignes.map((l) => (
              <li key={l.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ overflowWrap: "anywhere" }}>{l.pseudo}</span>
                <span className="mono-num" style={{ color: "var(--steel)" }}>{t.equipeDu(l.dus)}</span>
                {!l.moi && l.dus > 0 && (
                  <>
                    <label htmlFor={`part-${l.id}`} className="lecture-ecran">
                      {`${t.equipeRelayer} ${l.pseudo}`}
                    </label>
                    <input
                      id={`part-${l.id}`}
                      className="lol-input"
                      type="number"
                      min={1}
                      max={l.dus}
                      inputMode="numeric"
                      style={{ width: 90 }}
                      value={parts[l.id] ?? String(Math.min(l.dus, 10))}
                      onChange={(e) => setParts((p) => ({ ...p, [l.id]: e.target.value }))}
                    />
                    <button
                      type="button"
                      className="lol-btn"
                      disabled={occupe === l.id || !partValide(parts[l.id] ?? String(Math.min(l.dus, 10)), l.dus)}
                      onClick={() => relayer(l.id, Number(parts[l.id] ?? Math.min(l.dus, 10)))}
                      aria-label={`${t.equipeRelayer} ${l.pseudo}`}
                    >
                      {occupe === l.id ? t.equipeRelaisEnCours : t.equipeRelayer}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {/* Un total qui tait ce qu'il omet est un total faux. */}
          {etat.masques > 0 && (
            <p style={{ color: "var(--steel)", fontSize: ".8rem" }}>{t.equipeMasques(etat.masques)}</p>
          )}
        </>
      )}
    </div>
  );
}
