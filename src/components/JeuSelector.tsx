"use client";
import { useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { jeux as jeuxDict } from "@/lib/i18n/dictionaries/jeux";
import { JEUX, trouverJeu, type TypeJeu } from "@/lib/jeux";

/**
 * Choix du jeu : une liste de suggestions, plus la possibilité d'en saisir un
 * absent du catalogue. Pour un jeu libre, l'utilisateur précise s'il se compte
 * en parties ou au temps, puisque rien ne permet de le deviner.
 */
export function JeuSelector({
  jeu,
  typeJeu,
  onChange,
}: {
  jeu: string;
  typeJeu: TypeJeu;
  onChange: (jeu: string, typeJeu: TypeJeu) => void;
}) {
  const t = useT(jeuxDict);
  const connu = trouverJeu(jeu);
  const [libre, setLibre] = useState(!connu);

  const choisirDansListe = (nom: string) => {
    if (nom === "__autre__") {
      setLibre(true);
      onChange("", typeJeu);
      return;
    }
    setLibre(false);
    const def = trouverJeu(nom);
    onChange(nom, def?.type ?? "parties");
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs" style={{ color: "rgba(152,162,176,0.7)" }}>{t.label}</label>

      <select
        className="lol-select w-full"
        value={libre ? "__autre__" : jeu}
        onChange={(e) => choisirDansListe(e.target.value)}
      >
        {JEUX.map((j) => (
          <option key={j.nom} value={j.nom} style={{ background: "#14171C", color: "#ECEFF4" }}>
            {j.nom}
          </option>
        ))}
        <option value="__autre__" style={{ background: "#14171C", color: "#ECEFF4" }}>
          {t.autreJeu}
        </option>
      </select>

      {libre && (
        <div className="space-y-2">
          <input
            className="lol-input"
            placeholder={t.autrePlaceholder}
            value={jeu}
            maxLength={60}
            onChange={(e) => onChange(e.target.value, typeJeu)}
            autoFocus
          />
          <div className="flex gap-2">
            {(["parties", "temps"] as const).map((type) => {
              const actif = typeJeu === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onChange(jeu, type)}
                  aria-pressed={actif}
                  style={{
                    flex: 1, padding: "8px 12px", borderRadius: 8, cursor: "pointer",
                    fontSize: "0.8rem", textAlign: "left",
                    background: actif ? "rgba(255,180,84,0.08)" : "transparent",
                    border: `1px solid ${actif ? "var(--amber)" : "var(--line-strong)"}`,
                    color: actif ? "var(--amber)" : "rgba(236,239,244,0.6)",
                  }}
                >
                  <span style={{ display: "block", fontWeight: 600 }}>
                    {type === "parties" ? t.typeParties : t.typeTemps}
                  </span>
                  <span style={{ display: "block", fontSize: "0.72rem", opacity: 0.75, marginTop: 2 }}>
                    {type === "parties" ? t.typePartiesDesc : t.typeTempsDesc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
