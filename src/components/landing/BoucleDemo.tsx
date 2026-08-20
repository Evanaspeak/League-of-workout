"use client";
import { useEffect, useRef, useState } from "react";
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

/** Les libellés des trois vignettes, traduits comme le reste de la page. */
export type LibellesVignettes = {
  jeu: string; defaite: string; detailPartie: string;
  performance: string; niveau: string; niveauValeur: string;
  malus: string; malusValeur: string; dette: string; pts: string;
  aPayer: string; unite: string; choix: readonly string[];
};

export function BoucleDemo({
  temps, legende, aria, libelles,
}: {
  temps: TempsBoucle[];
  legende: string;
  aria: string;
  libelles: LibellesVignettes;
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
            <div className="boucle-visuel">
              {i === 0 && <TempsDefaite l={libelles} />}
              {i === 1 && <TempsCalcul l={libelles} />}
              {/* La clé change avec le temps affiché : le décompte repart de
                  zéro par remontage, plutôt qu'en écrivant dans un effet —
                  un état posé là déclenche une cascade de rendus. */}
              {i === 2 && <TempsPaiement key={`paiement-${actif}`} actif={actif === 2} l={libelles} />}
            </div>
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
function TempsDefaite({ l }: { l: LibellesVignettes }) {
  return (
    <div className="vign vign-defaite">
      <div className="vign-entete">
        <span className="vign-jeu">{l.jeu}</span>
        <span className="vign-etat perdu">{l.defaite}</span>
      </div>
      <div className="vign-kda">
        <span className="vign-kda-val">2</span><span className="vign-kda-sep">/</span>
        <span className="vign-kda-val mort">9</span><span className="vign-kda-sep">/</span>
        <span className="vign-kda-val">4</span>
      </div>
      <div className="vign-legende">{l.detailPartie}</div>
    </div>
  );
}

/** 2 — Le calcul, et le chiffre qui tombe. */
function TempsCalcul({ l }: { l: LibellesVignettes }) {
  return (
    <div className="vign vign-calcul">
      <div className="vign-ligne"><span>{l.performance}</span><span className="vign-mono">2/9/4</span></div>
      <div className="vign-ligne"><span>{l.niveau}</span><span className="vign-mono">{l.niveauValeur}</span></div>
      <div className="vign-ligne"><span>{l.malus}</span><span className="vign-mono vign-malus">{l.malusValeur}</span></div>
      <div className="vign-total">
        <span>{l.dette}</span>
        <span className="vign-total-val">38<i>{l.pts}</i></span>
      </div>
    </div>
  );
}

/**
 * 3 — L'addition, et le décompte.
 *
 * Le troisième temps montrait un nombre immobile. Or c'est le seul moment de
 * la boucle où quelqu'un fait quelque chose de son corps : le compteur monte
 * pendant qu'on regarde, et l'anneau se referme. C'est la démonstration que le
 * rapport réclamait — « un joueur perd, l'appli lui demande 20 pompes, il les
 * fait » — sans prétendre filmer ce qu'on n'a pas filmé.
 */
const TOTAL_REPS = 38;

function TempsPaiement({ actif, l }: { actif: boolean; l: LibellesVignettes }) {
  const mouvementReduit = useMouvementReduit();
  // Départ décidé au rendu : sans mouvement, le total est déjà là. Le poser
  // depuis un effet imposerait un second rendu pour rien.
  const [faites, setFaites] = useState(() => (mouvementReduit ? TOTAL_REPS : 0));
  const minuteur = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!actif || mouvementReduit) return;
    // Une répétition toutes les 70 ms : le compteur atteint le total bien avant
    // la fin du temps, et s'y arrête. Un décompte qui déborde du temps qu'on
    // lui laisse ne se lit pas.
    minuteur.current = setInterval(() => {
      setFaites((n) => {
        if (n >= TOTAL_REPS) {
          if (minuteur.current) clearInterval(minuteur.current);
          return TOTAL_REPS;
        }
        return n + 1;
      });
    }, 70);
    return () => { if (minuteur.current) clearInterval(minuteur.current); };
  }, [actif, mouvementReduit]);

  const part = faites / TOTAL_REPS;
  const RAYON = 26;
  const circonference = 2 * Math.PI * RAYON;

  return (
    <div className="vign vign-paiement">
      <div className="vign-paie-entete">
        <div>
          <div className="vign-paie-titre">{l.aPayer}</div>
          <div className="vign-paie-val">
            {faites}<span className="vign-paie-sur">/ {TOTAL_REPS}</span><i>{l.unite}</i>
          </div>
        </div>
        <svg className="vign-anneau" width="64" height="64" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r={RAYON} fill="none" stroke="rgba(236,239,244,0.1)" strokeWidth="4" />
          <circle
            cx="32" cy="32" r={RAYON} fill="none"
            stroke={part >= 1 ? "var(--victory)" : "var(--ember)"} strokeWidth="4" strokeLinecap="round"
            strokeDasharray={circonference}
            strokeDashoffset={circonference * (1 - part)}
            transform="rotate(-90 32 32)"
          />
        </svg>
      </div>
      <div className="vign-paie-choix">
        {l.choix.map((c, i) => (
          <span key={c} className={`vign-puce${i === 0 ? " actif" : ""}`}>{c}</span>
        ))}
      </div>
    </div>
  );
}

