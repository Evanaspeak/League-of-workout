"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useT, useNombre } from "@/lib/i18n/LocaleContext";
import { testPompes as dict } from "@/lib/i18n/dictionaries/testPompes";
import { getLevelParPompes, testAFaire, type LevelCfg } from "@/lib/scoring";

/**
 * La courbe arrive à la demande, et jamais avec ce fichier.
 *
 * `recharts` pèse cent kilo-octets, et ce composant est rendu à trois endroits
 * dont deux sur le tableau de bord, où l'on ne montre pas l'histoire. Un
 * `import` ordinaire du même module ailleurs annulerait ce découpage — c'est la
 * règle que `pontsDeChargement.test.ts` garde, et il n'y en a aucun.
 */
const CourbeForce = dynamic(
  () => import("@/components/CourbeForce").then((m) => m.CourbeForce),
  { ssr: false },
);

/**
 * Test de pompes maximales : le nombre que quelqu'un enchaîne d'affilée fixe
 * son niveau, donc le multiplicateur appliqué à toute sa dette.
 *
 * Il remplace le test de gainage, qui mesurait autre chose que la monnaie de
 * l'application, et qu'on redemandait à chaque session — au point que plus
 * personne ne le refaisait vraiment. Une fois par mois suffit : la force ne
 * change pas d'un soir à l'autre.
 */
export function TestPompes({
  pompesMax,
  faitLe,
  niveaux,
  onEnregistre,
  historique,
  autonome = false,
}: {
  pompesMax: number;
  faitLe: string | null;
  niveaux: LevelCfg[];
  /**
   * Enregistre le test. Rend `false` quand le serveur n'en a pas voulu.
   *
   * Elle rendait `void`, donc l'écran fermait le panneau et vidait la saisie
   * quoi qu'il arrive. Sur le tableau de bord, où l'appelant avalait l'échec,
   * on saisissait son chiffre, le panneau se refermait, et rien n'était
   * enregistré. C'est ce test qui fixe le niveau, donc toute la dette.
   */
  onEnregistre: (valeur: number) => Promise<boolean>;
  /**
   * L'histoire des tests, pour la courbe (ligne 152 du plan).
   *
   * Elle est OPTIONNELLE, et c'est le point : l'écran des réglages la donne,
   * le tableau de bord non — le test n'y est qu'un rappel, et une courbe de
   * progression n'y a rien à faire. Un composant qui irait la chercher
   * lui-même paierait donc trois appels pour un seul affichage, et le
   * troisième appelant qu'on ajoutera demain le paierait sans l'avoir décidé.
   */
  historique?: { jour: string; pompes: number }[];
  /**
   * Le test est présenté seul, dans son propre encadré — sur le tableau de
   * bord. Il n'a alors pas de section au-dessus dont il faudrait se séparer
   * par un trait.
   */
  autonome?: boolean;
}) {
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
  /**
   * Le nombre de l'infobulle passe par `Intl` comme partout ailleurs. Il ne
   * dépassera pas le millier — la borne du test est cinq cents — mais une
   * seconde façon d'écrire un nombre à côté de la première est exactement ce
   * qui finit par diverger.
   */
  const nombre = useNombre();
  const [saisie, setSaisie] = useState("");
  const [ouvert, setOuvert] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [echec, setEchec] = useState(false);

  const aFaire = testAFaire(pompesMax, faitLe);
  const niveau = niveaux.length > 0 ? getLevelParPompes(pompesMax, niveaux) : null;
  const valeur = Number(saisie);
  const valide = Number.isFinite(valeur) && valeur >= 0 && valeur <= 500 && saisie !== "";

  const enregistrer = async () => {
    if (!valide) return;
    setOccupe(true);
    setEchec(false);
    let ok = false;
    try {
      ok = await onEnregistre(Math.round(valeur));
    } catch {
      ok = false;
    }
    setOccupe(false);
    // Le panneau ne se ferme et la saisie ne s'efface que si le chiffre est
    // parti : sinon on efface ce qu'on vient de taper sans l'avoir enregistré.
    if (!ok) { setEchec(true); return; }
    setOuvert(false);
    setSaisie("");
  };

  const apercu = valide && niveaux.length > 0 ? getLevelParPompes(valeur, niveaux) : null;

  return (
    <div
      style={autonome ? undefined : { borderTop: "1px solid var(--line)", paddingTop: 16 }}
      className="space-y-3"
    >
      <h2 className="titre-section">
        {t.titre}
      </h2>
      <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
        {t.aide}
      </p>

      {pompesMax > 0 && niveau && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
          <span className="mono-num" style={{ fontSize: "1.6rem", fontWeight: 600, color: "var(--amber)", lineHeight: 1.1 }}>
            {pompesMax}
          </span>
          <span className="text-xs" style={{ color: "var(--faint)" }}>
            {t.resume(niveau.niveau, decimal(niveau.multiplicateur))}
          </span>
        </div>
      )}

      {aFaire && (
        <p className="text-xs" style={{ color: "var(--amber)" }}>
          {pompesMax > 0 ? t.perime : t.jamaisFait}
        </p>
      )}

      {/*
        Deux points au minimum : une courbe d'un seul point est un point, et
        l'afficher promet une tendance qui n'existe pas encore. C'est la règle
        déjà posée pour la courbe de poids.
      */}
      {historique && historique.length >= 2 && (
        <div className="space-y-2" style={{ paddingTop: 4 }}>
          <h3 className="text-sm" style={{ color: "var(--bone)", fontWeight: 600 }}>
            {t.courbeTitre}
          </h3>
          <CourbeForce
            points={historique}
            formaterJour={(j) => j.slice(5)}
            formaterPompes={(n) => t.courbeValeur(nombre(n))}
          />
        </div>
      )}
      {historique && historique.length === 1 && (
        <p className="text-xs" style={{ color: "var(--faint)" }}>{t.courbeUnTest}</p>
      )}

      {!ouvert && (
        <button className="lol-btn text-sm" onClick={() => setOuvert(true)}>
          {pompesMax > 0 ? t.refaire : t.faire}
        </button>
      )}

      {ouvert && (
        <div className="space-y-3" style={{
          padding: "14px 16px",
          borderRadius: 8,
          background: "color-mix(in srgb, var(--steel) 5%, transparent)",
          border: "1px solid var(--line)",
        }}>
          <p className="text-xs" style={{ color: "var(--muted)", lineHeight: 1.6 }}>
            {t.consigne}
          </p>
          <div>
            <label htmlFor="test-pompes" className="block text-xs mb-1" style={{ color: "var(--steel)" }}>
              {t.champ}
            </label>
            <input
              id="test-pompes"
              type="number"
              min="0"
              max="500"
              className="lol-input text-center text-2xl font-bold"
              value={saisie}
              onChange={(e) => setSaisie(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enregistrer()}
              autoFocus
            />
          </div>

          {apercu && (
            <p className="text-xs" style={{ color: "var(--amber)" }}>
              {t.apercu(apercu.niveau, decimal(apercu.multiplicateur))}
            </p>
          )}

          {echec && (
            <p role="alert" className="text-xs" style={{ color: "var(--loss)" }}>{t.echec}</p>
          )}

          <div className="flex gap-2">
            <button
              className="text-xs px-3 py-2 rounded flex-1"
              style={{ background: "color-mix(in srgb, var(--steel) 10%, transparent)", border: "1px solid var(--line-strong)", color: "var(--bone)", cursor: "pointer" }}
              onClick={() => { setOuvert(false); setSaisie(""); }}
            >
              {t.annuler}
            </button>
            <button className="lol-btn text-sm flex-1" onClick={enregistrer} disabled={!valide || occupe}>
              {occupe ? "…" : t.enregistrer}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
