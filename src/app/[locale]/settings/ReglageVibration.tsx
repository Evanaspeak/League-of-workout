"use client";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { exercices as exercicesDict } from "@/lib/i18n/dictionaries/exercices";
import { poserVibration, vibrationActive, vibrationDisponible, vibrerRepetition } from "@/lib/vibration";

/**
 * Vibrer à chaque répétition comptée (réponse 207 : « en option »).
 *
 * **Le réglage ne passe par aucune route**, contrairement à tous ses voisins
 * de cette rubrique : il vit dans l'APPAREIL. Un téléphone vibre, un poste de
 * bureau non, et ranger ce choix sur le compte le ferait voyager de l'un à
 * l'autre — donc allumer une option qui ne veut rien dire là où elle atterrit.
 *
 * **Rien n'est lu au rendu serveur**, et c'est ce qui décide de la forme :
 * ni le stockage ni `navigator.vibrate` n'existent là-bas, donc l'état de
 * départ y serait faux et l'hydratation le corrigerait sous les yeux. On rend
 * la case éteinte, puis on lit une fois montés.
 *
 * **Et l'écran DIT quand l'appareil ne sait pas vibrer** plutôt que de cacher
 * le réglage : Safari sur iPhone ne l'implémente pas, c'est la moitié des
 * téléphones, et une case absente laisse chercher où elle est passée. C'est
 * la règle déjà posée pour « Tes jeux » hors application.
 */
export function ReglageVibration() {
  const t = useT(exercicesDict);
  const [actif, setActif] = useState(false);
  const [dispo, setDispo] = useState(true);

  useEffect(() => {
    setActif(vibrationActive());
    setDispo(vibrationDisponible(navigator));
  }, []);

  const choisir = (valeur: boolean) => {
    poserVibration(valeur);
    setActif(valeur);
    // Un aperçu à l'instant du choix : c'est la seule façon de savoir ce
    // qu'on vient d'allumer sans aller faire une séance pour le constater.
    if (valeur) vibrerRepetition(navigator);
  };

  return (
    <div style={{ borderTop: "1px solid var(--line)", paddingTop: 16 }} className="space-y-3">
      <h2 className="titre-section">{t.vibrationTitre}</h2>
      <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
        {t.vibrationAide}
      </p>
      {!dispo && (
        <p className="text-xs" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
          {t.vibrationIndisponible}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {[
          { valeur: true, libelle: t.vibrationOui },
          { valeur: false, libelle: t.vibrationNon },
        ].map(({ valeur, libelle }) => {
          const choisi = valeur === actif;
          return (
            <button
              key={libelle}
              onClick={() => choisir(valeur)}
              aria-pressed={choisi}
              disabled={!dispo}
              style={{
                padding: "7px 14px",
                borderRadius: 999,
                cursor: dispo ? "pointer" : "not-allowed",
                fontSize: "0.8rem",
                minHeight: 44,
                opacity: dispo ? 1 : 0.45,
                background: choisi ? "rgba(255,180,84,0.1)" : "transparent",
                border: `1px solid ${choisi ? "var(--amber)" : "var(--line-strong)"}`,
                color: choisi ? "var(--amber)" : "var(--muted)",
                transition: "all 0.15s",
              }}
            >
              {libelle}
            </button>
          );
        })}
      </div>
    </div>
  );
}
