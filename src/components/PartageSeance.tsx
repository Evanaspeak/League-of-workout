"use client";
import { useState } from "react";
import { Modale } from "@/components/Modale";
import { useT } from "@/lib/i18n/LocaleContext";
import { partageSeance as dict } from "@/lib/i18n/dictionaries/partageSeance";

/**
 * Ce qu'on propose après une grosse séance (réponse 122).
 *
 * L'image est dessinée AU SERVEUR : une capture d'écran dépendrait de la
 * taille de la fenêtre, du thème et des polices installées, et rendrait une
 * image différente à chaque appareil.
 *
 * **Elle ne se télécharge pas par un bouton.** Le navigateur d'un visiteur
 * d'artefact bloque les téléchargements que la page déclenche elle-même, et
 * surtout « enregistrer l'image » est un geste que tout le monde connaît déjà
 * sur une image affichée. On la montre, et on laisse faire.
 */
export function PartageSeance({ points, onFermer }: { points: number; onFermer: () => void }) {
  const t = useT(dict);
  const [cassee, setCassee] = useState(false);

  return (
    <Modale titre={t.titre} onFermer={onFermer} largeur="42rem">
      <div className="space-y-3">
        <p style={{ color: "var(--steel)", maxWidth: "50ch" }}>{t.aide(points)}</p>
        {cassee ? (
          /*
            L'image a échoué, pas la séance. C'est la seule phrase qui compte,
            et le défaut déjà corrigé sur l'image du bilan : sans elle, on voit
            l'icône de fichier cassé du navigateur et on croit avoir tout perdu.
          */
          <p role="alert" style={{ color: "var(--loss)" }}>{t.echec}</p>
        ) : (
          <img
            src="/api/seance/image"
            alt={t.alt(points)}
            /**
             * Les dimensions réservent la place, et ce n'est pas décoratif.
             *
             * Sans elles, la fenêtre n'a aucune hauteur à garder tant que
             * l'image n'est pas là : elle grandit d'un coup quand elle arrive,
             * et comme la fenêtre est centrée, la phrase du dessus remonte
             * sous les yeux de quelqu'un en train de la lire. Et pendant
             * l'attente, une image cassée rend son texte de remplacement, qui
             * fait deux lignes ici — c'est le défaut mesuré sur les icônes de
             * l'historique, à une autre échelle.
             *
             * 1200 × 630 sont les dimensions rendues par la route ; avec
             * `height: auto`, le navigateur en déduit le rapport et garde la
             * place avant même d'avoir un pixel.
             */
            width={1200}
            height={630}
            style={{
              width: "100%", height: "auto",
              borderRadius: 8, border: "1px solid var(--line)",
            }}
            onError={() => setCassee(true)}
            ref={(el) => {
              // Une image déjà terminée ne déclenche plus `onError` : React
              // n'attache son écouteur qu'après l'hydratation, et l'échec peut
              // tomber avant. On regarde donc à la première occasion, EN PLUS
              // d'écouter — c'est la correction déjà faite sur l'image du bilan.
              if (el && el.complete && el.naturalWidth === 0) setCassee(true);
            }}
          />
        )}
      </div>
    </Modale>
  );
}
