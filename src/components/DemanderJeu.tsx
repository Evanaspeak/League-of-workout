"use client";
import { fetchBorne } from "@/lib/reseau";
import { useState } from "react";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { demandeJeu as dict } from "@/lib/i18n/dictionaries/demandeJeu";
import { translateApiError } from "@/lib/i18n/apiErrors";
import { NOM_MAX } from "@/lib/demandeJeu";

/**
 * Déclarer un jeu absent du catalogue (réponse 180).
 *
 * « Ça décide de la suite » : ce qui compte est le nombre de PERSONNES, et
 * l'unicité qui le garantit vit en base. Ici on ne fait que demander.
 *
 * Le champ est libre, et son texte ne part vers aucun autre utilisateur : la
 * réponse 127 refuse d'avoir à modérer, et ce qui la respecte est que personne
 * d'autre que l'administration ne lise jamais ce mot.
 */
export function DemanderJeu() {
  const t = useT(dict);
  const { locale } = useLocale();
  const [nom, setNom] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [merci, setMerci] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  const envoyer = async () => {
    const propre = nom.trim();
    if (!propre || envoi) return;
    setEnvoi(true);
    setErreur(null);
    setMerci(null);
    try {
      const res = await fetchBorne("/api/jeux/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: propre }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // Le refus de la route dit POURQUOI — déjà au catalogue, plafond
        // atteint — et c'est ce qu'il faut lire plutôt qu'un message générique.
        setErreur(data?.error ? translateApiError(data.error, locale) : t.echec);
        return;
      }
      setMerci(t.merci(data?.nom ?? propre));
      setNom("");
    } catch {
      // Sans réseau, la promesse part en erreur : sans ce rattrapage, le
      // bouton resterait sur « Envoi… » pour toujours.
      setErreur(t.echec);
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div style={{
      border: "1px solid var(--line)", borderRadius: 6,
      padding: "11px 14px", display: "flex", flexDirection: "column", gap: 6,
    }}>
      <span style={{ color: "var(--bone)", fontWeight: 600, fontSize: "0.85rem" }}>
        {t.titre}
      </span>
      <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6, margin: 0 }}>
        {t.aide}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label htmlFor="demande-jeu" className="lecture-ecran">{t.champ}</label>
        <input
          id="demande-jeu"
          className="lol-input"
          style={{ flex: "1 1 10rem", minWidth: 0 }}
          maxLength={NOM_MAX}
          value={nom}
          placeholder={t.champ}
          onChange={(e) => setNom(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") void envoyer(); }}
        />
        <button
          type="button"
          className="lol-btn text-xs"
          disabled={envoi || nom.trim().length === 0}
          onClick={() => void envoyer()}
        >
          {envoi ? t.envoi : t.envoyer}
        </button>
      </div>
      {merci && <p className="text-xs" role="status" style={{ color: "var(--win)" }}>{merci}</p>}
      {erreur && <p className="text-xs" role="alert" style={{ color: "var(--loss)" }}>{erreur}</p>}
    </div>
  );
}
