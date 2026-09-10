"use client";
import { fetchBorne } from "@/lib/reseau";
import { useEffect, useState } from "react";
import { useT, usePourcentage, useNombre } from "@/lib/i18n/LocaleContext";
import { adminMesures } from "@/lib/i18n/dictionaries/adminMesures";
import { formaterDelai, FACTEUR_ALERTE, PARTIES_MIN_COMPARAISON,
  type EquilibreJeux, type Mesures } from "@/lib/mesures";

type Reponse = Mesures & {
  veille?: { pseudo: string; points: number }[];
  seuilSemaine?: number;
  equilibre?: EquilibreJeux;
  demandesJeux?: { nom: string; personnes: number }[];
  montres?: { oui: number; non: number; sansReponse: number };
};

/**
 * Les chiffres d'usage, à l'endroit où ils changent une décision.
 *
 * Ils ne servent pas à se rassurer : le délai jusqu'à la première partie dit
 * si l'entrée dans le produit est trop longue, et le nombre de revenus dit si
 * le produit sert à quelque chose. Les deux étaient inconnus.
 */
export default function AdminMesures() {
  const nombre = useNombre();
  const pourcent = usePourcentage();
  const t = useT(adminMesures);
  const [m, setM] = useState<Reponse | null>(null);
  const [erreur, setErreur] = useState(false);

  useEffect(() => {
    fetchBorne("/api/admin/mesures")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("refus"))))
      .then(setM)
      .catch(() => setErreur(true));
  }, []);

  const ligne = (libelle: string, valeur: string) => (
    <div
      className="flex items-baseline justify-between gap-3"
      style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}
    >
      <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{libelle}</span>
      <b style={{ fontVariantNumeric: "tabular-nums" }}>{valeur}</b>
    </div>
  );

  return (
    <div className="lol-panel p-5 space-y-4">
      <div>
        <h2 className="titre-section">{t.titre}</h2>
        <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.aide}</p>
      </div>

      {erreur && <p role="alert" className="text-sm loss-text">{t.echec}</p>}
      {!erreur && m === null && (
        <p className="text-sm" style={{ color: "var(--steel)" }}>{t.chargement}</p>
      )}

      {m && m.comptes === 0 && (
        <p className="text-sm" style={{ color: "var(--steel)" }}>{t.vide}</p>
      )}

      {m && m.comptes > 0 && (
        <div className="flex flex-col">
          {ligne(t.comptes, String(m.comptes))}
          {ligne(t.avecPartie, `${m.avecPartie} (${pourcent(m.partActifs)})`)}
          {ligne(t.delaiMedian, formaterDelai(m.delai.median))}
          {ligne(t.delaiQuartiles, `${formaterDelai(m.delai.p25)} · ${formaterDelai(m.delai.p75)}`)}
          {ligne(t.dansLaJournee, String(m.dansLaJournee))}
          {ligne(t.dansLaSemaine, String(m.dansLaSemaine))}
          {ligne(t.revenus, String(m.revenus))}
        </div>
      )}

      {/* Combien portent une montre (réponse 035). C'est ce qui décide si
          brancher un service tiers vaut deux nuits — et les TROIS états sont
          montrés, parce que ranger « pas répondu » avec l'un des deux
          fausserait la proportion dans le sens qu'on aurait choisi. */}
      {m?.montres && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <h3 className="titre-section" style={{ fontSize: "0.9rem" }}>{t.montresTitre}</h3>
          <p className="text-xs mt-1 mb-2" style={{ color: "var(--steel)" }}>{t.montresAide}</p>
          {ligne(t.montresOui, nombre(m.montres.oui))}
          {ligne(t.montresNon, nombre(m.montres.non))}
          {ligne(t.montresSans, nombre(m.montres.sansReponse))}
        </div>
      )}

      {/* Le catalogue est fermé : la seule façon de savoir ce qui y manque est
          de laisser le dire, et de compter. (réponse 180) */}
      {m?.demandesJeux && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <h3 className="titre-section" style={{ fontSize: "0.9rem" }}>{t.demandesTitre}</h3>
          <p className="text-xs mt-1 mb-2" style={{ color: "var(--steel)" }}>{t.demandesAide}</p>
          {m.demandesJeux.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--steel)" }}>{t.demandesAucun}</p>
          ) : (
            <div className="flex flex-col">
              {m.demandesJeux.map((d) => (
                <div key={d.nom} className="flex items-baseline justify-between gap-3"
                  style={{ padding: "4px 0", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--muted)", overflowWrap: "anywhere" }}>{d.nom}</span>
                  <b style={{ color: "var(--gold)", fontVariantNumeric: "tabular-nums" }}>
                    {t.demandesPersonnes(nombre(d.personnes), d.personnes)}
                  </b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Un jeu qui paie deux fois plus qu'un autre déplace les gens vers le
          moins cher, ce qui n'est pas ce que le produit demande (réponse 185).
          Le facteur n'existe qu'à partir de deux jeux assez joués : sous ce
          plancher on montre les moyennes sans rien en conclure. */}
      {m?.equilibre && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <h3 className="titre-section" style={{ fontSize: "0.9rem" }}>{t.equilibreTitre}</h3>
          <p className="text-xs mt-1 mb-2" style={{ color: "var(--steel)" }}>
            {t.equilibreAide(PARTIES_MIN_COMPARAISON, FACTEUR_ALERTE)}
          </p>
          {m.equilibre.jeux.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--steel)" }}>{t.equilibreAucun}</p>
          ) : (
            <div className="flex flex-col">
              {m.equilibre.jeux.map((g) => (
                <div key={g.jeu} className="flex items-baseline justify-between gap-3"
                  style={{ padding: "4px 0", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--muted)" }}>{g.jeu}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    <b style={{ color: "var(--gold)" }}>{nombre(g.moyenne)}</b>
                    <span style={{ color: "var(--steel)", marginLeft: 8 }}>
                      {t.equilibreParties(nombre(g.parties), g.parties)}
                    </span>
                  </span>
                </div>
              ))}
              {m.equilibre.facteur === null ? (
                <p className="text-xs mt-2" style={{ color: "var(--steel)" }}>{t.equilibreAucun}</p>
              ) : (
                <p className="text-sm mt-2"
                  style={{ color: m.equilibre.derape ? "var(--loss)" : "var(--steel)" }}>
                  {t.equilibreFacteur(nombre(m.equilibre.facteur))}
                  {m.equilibre.derape && <> · {t.equilibreDerape}</>}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* L'application réclame de l'effort après une défaite : elle peut servir
          à se punir. Ceci est là pour que quelqu'un puisse regarder. */}
      {m && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14 }}>
          <h3 className="titre-section" style={{ fontSize: "0.9rem" }}>{t.veilleTitre}</h3>
          <p className="text-xs mt-1 mb-2" style={{ color: "var(--steel)" }}>
            {t.veilleAide(m.seuilSemaine ?? 0)}
          </p>
          {(m.veille ?? []).length === 0 ? (
            <p className="text-sm" style={{ color: "var(--steel)" }}>{t.veilleAucun}</p>
          ) : (
            <div className="flex flex-col">
              {(m.veille ?? []).map((u) => (
                <div key={u.pseudo} className="flex items-baseline justify-between gap-3"
                  style={{ padding: "4px 0", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--muted)" }}>{u.pseudo}</span>
                  <b style={{ color: "var(--gold)", fontVariantNumeric: "tabular-nums" }}>{nombre(u.points)}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
