"use client";
import { useEffect, useState } from "react";
import { useMouvementReduit } from "@/lib/valeurClient";

/**
 * La boucle d'usage, jouée en trois temps.
 *
 * On reprochait au site de ne rien montrer : ni le produit, ni ce qu'on en
 * fait. Une capture d'écran montre le produit ; elle ne montre pas la boucle.
 * Or c'est la boucle qui est le concept — tu perds, l'app chiffre, tu paies —
 * et elle se raconte en trois images, pas en trois paragraphes.
 *
 * Trois temps qui s'enchaînent seuls, une barre de progression qui dit où l'on
 * en est, et des pastilles pour reprendre la main. Le mouvement s'arrête
 * entièrement si le système le demande : les trois temps sont alors visibles
 * ensemble, empilés.
 */

const DUREE_MS = 3400;

export type TempsBoucle = {
  numero: string;
  titre: string;
  texte: string;
};

export function BoucleDemo({
  temps, legende, aria,
}: {
  temps: TempsBoucle[];
  legende: string;
  aria: string;
}) {
  const mouvementReduit = useMouvementReduit();
  const [actif, setActif] = useState(0);
  const [manuel, setManuel] = useState(false);

  useEffect(() => {
    if (mouvementReduit || manuel) return;
    const id = setInterval(() => setActif((n) => (n + 1) % temps.length), DUREE_MS);
    return () => clearInterval(id);
  }, [mouvementReduit, manuel, temps.length]);

  return (
    <div className="boucle" aria-label={aria}>
      <div className="boucle-scene">
        {temps.map((t, i) => (
          <div
            key={t.numero}
            className={`boucle-temps${i === actif ? " actif" : ""}`}
            aria-hidden={mouvementReduit ? undefined : i !== actif}
          >
            <div className="boucle-visuel">{VISUELS[i] ?? null}</div>
            <div className="boucle-texte">
              <span className="boucle-num">{t.numero}</span>
              <h3>{t.titre}</h3>
              <p>{t.texte}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="boucle-barre" role="tablist" aria-label={legende}>
        {temps.map((t, i) => (
          <button
            key={t.numero}
            role="tab"
            aria-selected={i === actif}
            aria-label={t.titre}
            className={`boucle-onglet${i === actif ? " actif" : ""}`}
            onClick={() => { setManuel(true); setActif(i); }}
          >
            <span className="boucle-jauge" />
            <span className="boucle-onglet-nom">{t.titre}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Les trois images de la boucle ────────────────────────────────────────
   Dessinées, pas photographiées : ce sont les mêmes éléments d'interface que
   l'application, à l'échelle d'une vignette. Une capture d'écran réelle serait
   illisible à cette taille.                                               */

/** 1 — La partie se termine, et elle est perdue. */
function TempsDefaite() {
  return (
    <div className="vign vign-defaite">
      <div className="vign-entete">
        <span className="vign-jeu">League of Legends</span>
        <span className="vign-etat perdu">Défaite</span>
      </div>
      <div className="vign-kda">
        <span className="vign-kda-val">2</span><span className="vign-kda-sep">/</span>
        <span className="vign-kda-val mort">9</span><span className="vign-kda-sep">/</span>
        <span className="vign-kda-val">4</span>
      </div>
      <div className="vign-legende">Classée Solo/Duo · 34 min</div>
    </div>
  );
}

/** 2 — Le calcul, et le chiffre qui tombe. */
function TempsCalcul() {
  return (
    <div className="vign vign-calcul">
      <div className="vign-ligne"><span>Performance</span><span className="vign-mono">2/9/4</span></div>
      <div className="vign-ligne"><span>Ton niveau</span><span className="vign-mono">3 · ×1,8</span></div>
      <div className="vign-ligne"><span>Défaite</span><span className="vign-mono vign-malus">+40 %</span></div>
      <div className="vign-total">
        <span>Dette</span>
        <span className="vign-total-val">38<i>pts</i></span>
      </div>
    </div>
  );
}

/** 3 — L'addition, dans la monnaie choisie. */
function TempsPaiement() {
  return (
    <div className="vign vign-paiement">
      <div className="vign-paie-titre">À payer maintenant</div>
      <div className="vign-paie-val">38<i>pompes</i></div>
      <div className="vign-paie-choix">
        <span className="vign-puce actif">38 pompes</span>
        <span className="vign-puce">57 squats</span>
        <span className="vign-puce">4 min 25 de boxe</span>
      </div>
    </div>
  );
}

const VISUELS = [<TempsDefaite key="1" />, <TempsCalcul key="2" />, <TempsPaiement key="3" />];
