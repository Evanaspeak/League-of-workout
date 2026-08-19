"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleContext";
import { visite as dict } from "@/lib/i18n/dictionaries/visite";
import { estPagePublique } from "@/lib/pagesPubliques";
import { Icone } from "@/components/Icone";

/**
 * Visite guidée de la première connexion.
 *
 * La modale d'accueil explique ce que fait le produit ; elle ne dit pas OÙ sont
 * les choses. On arrivait donc sur un tableau de bord complet sans savoir par
 * quoi commencer — et la fonction la plus utile, le rail, est justement celle
 * qu'on ne remarque pas.
 *
 * La visite éclaire les vrais éléments de l'écran, un par un. Elle ne décrit
 * pas une capture : elle pointe ce qui est réellement là, donc elle ne peut pas
 * se désynchroniser de l'interface. Les ancres sont posées par un attribut
 * `data-visite` sur les éléments concernés ; une ancre absente fait sauter
 * l'étape plutôt que casser la visite.
 */

const CLE_VUE = "low_visite";

/** Marge autour de l'élément éclairé, en pixels. */
const MARGE = 8;
/** Au-delà, on considère que l'ancre ne viendra pas. */
const ATTENTE_MAX_MS = 4000;

type Etape = {
  /** Valeur de `data-visite` à éclairer. */
  cle: string;
  titre: string;
  texte: string;
  /**
   * Ancre de remplacement sur écran étroit, où le rail est replié derrière son
   * bouton et où ses actions n'ont aucune surface à l'écran.
   */
  cleEtroite?: string;
};

function estVisible(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return false;
  // Un élément replié hors du cadre a bien une taille, mais aucune surface
  // utile : l'éclairer désignerait le vide.
  return r.right > 0 && r.left < window.innerWidth
    && r.bottom > 0 && r.top < window.innerHeight + r.height;
}

export function VisiteGuidee() {
  const t = useT(dict);
  const chemin = usePathname();

  const ETAPES: Etape[] = [
    { cle: "rail", cleEtroite: "rail-bascule", titre: t.railTitre, texte: t.railTexte },
    { cle: "rail-session", cleEtroite: "rail-bascule", titre: t.sessionTitre, texte: t.sessionTexte },
    { cle: "rail-ajout", cleEtroite: "rail-bascule", titre: t.ajoutTitre, texte: t.ajoutTexte },
    { cle: "dette", cleEtroite: "rail-bascule", titre: t.detteTitre, texte: t.detteTexte },
    { cle: "stats", titre: t.statsTitre, texte: t.statsTexte },
    { cle: "nav-history", titre: t.historiqueTitre, texte: t.historiqueTexte },
    { cle: "nav-settings", titre: t.reglagesTitre, texte: t.reglagesTexte },
  ];

  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  /**
   * Le cadre porte l'étape à laquelle il appartient. C'est ce qui évite de
   * l'effacer à chaque changement d'étape : un cadre périmé se reconnaît à son
   * indice, plutôt que de demander une remise à zéro depuis l'effet — laquelle
   * imposerait un rendu supplémentaire.
   */
  const [cadre, setCadre] = useState<{ i: number; rect: DOMRect } | null>(null);
  const indexRef = useRef(0);

  // Ne démarre qu'une fois la modale d'accueil passée : les deux en même temps
  // feraient deux couches d'explication superposées.
  useEffect(() => {
    if (estPagePublique(chemin)) return;
    if (localStorage.getItem(CLE_VUE)) return;
    if (!localStorage.getItem("low_onboarded")) return;
    const minuteur = setTimeout(() => setActive(true), 400);
    return () => clearTimeout(minuteur);
  }, [chemin]);

  const cloturer = useCallback(() => {
    localStorage.setItem(CLE_VUE, "1");
    setActive(false);
  }, []);

  /**
   * Vise l'ancre de l'étape courante, en laissant à la page le temps de la
   * poser : le tableau de bord charge ses données, et le rail n'existe pas
   * encore à la première image.
   *
   * Tout part d'un minuteur, y compris la première recherche : rien ne doit
   * poser d'état dans la foulée du rendu, ce qui imposerait un rendu de plus à
   * chaque étape.
   */
  useEffect(() => {
    const i = index;
    const etape = ETAPES[i];
    if (!active || !etape) return;
    indexRef.current = i;

    const etroit = window.innerWidth < 900;
    const cles = etroit && etape.cleEtroite ? [etape.cleEtroite, etape.cle] : [etape.cle];
    const debut = Date.now();
    let annule = false;
    let minuteur: ReturnType<typeof setTimeout>;

    const chercher = () => {
      if (annule || indexRef.current !== i) return;
      for (const cle of cles) {
        const el = document.querySelector(`[data-visite="${cle}"]`);
        if (el && estVisible(el)) {
          el.scrollIntoView({ block: "center", behavior: "smooth" });
          // La mesure attend la fin du défilement, sinon le halo se pose là où
          // l'élément était.
          minuteur = setTimeout(() => {
            if (!annule && indexRef.current === i) setCadre({ i, rect: el.getBoundingClientRect() });
          }, 320);
          return;
        }
      }
      if (Date.now() - debut > ATTENTE_MAX_MS) {
        // Ancre introuvable : l'étape n'a rien à montrer, on passe — et si
        // c'était la dernière, la visite s'achève.
        if (i + 1 >= ETAPES.length) cloturer();
        else setIndex((n) => (n === i ? i + 1 : n));
        return;
      }
      minuteur = setTimeout(chercher, 120);
    };

    minuteur = setTimeout(chercher, 0);
    return () => { annule = true; clearTimeout(minuteur); };
    // Les étapes sont reconstruites à chaque rendu (les libellés viennent des
    // traductions) mais leur contenu ne change pas d'un rendu à l'autre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index, cloturer]);

  // L'élément éclairé bouge avec la page : on resuit sa position.
  useEffect(() => {
    if (!active) return;
    const suivre = () => {
      const etape = ETAPES[indexRef.current];
      if (!etape) return;
      const etroit = window.innerWidth < 900;
      const cles = etroit && etape.cleEtroite ? [etape.cleEtroite, etape.cle] : [etape.cle];
      for (const cle of cles) {
        const el = document.querySelector(`[data-visite="${cle}"]`);
        if (el && estVisible(el)) {
          setCadre({ i: indexRef.current, rect: el.getBoundingClientRect() });
          return;
        }
      }
    };
    window.addEventListener("resize", suivre);
    window.addEventListener("scroll", suivre, true);
    return () => {
      window.removeEventListener("resize", suivre);
      window.removeEventListener("scroll", suivre, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // Échap abandonne : une couche qui recouvre tout doit toujours avoir sa sortie.
  useEffect(() => {
    if (!active) return;
    const surTouche = (e: KeyboardEvent) => { if (e.key === "Escape") cloturer(); };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, [active, cloturer]);

  // Un cadre mesuré pour une autre étape ne vaut plus rien.
  const rect = cadre && cadre.i === index ? cadre.rect : null;
  const etape = ETAPES[index];
  if (!active || !rect || !etape) return null;

  const trou = {
    left: Math.max(4, rect.left - MARGE),
    top: Math.max(4, rect.top - MARGE),
    width: rect.width + MARGE * 2,
    height: rect.height + MARGE * 2,
  };

  // La bulle se place sous le halo s'il reste de la place, au-dessus sinon.
  const LARGEUR_BULLE = 330;
  const dessous = trou.top + trou.height + 260 < window.innerHeight;
  const bulleTop = dessous ? trou.top + trou.height + 14 : undefined;
  const bulleBottom = dessous ? undefined : window.innerHeight - trou.top + 14;
  const bulleLeft = Math.min(
    Math.max(12, trou.left + trou.width / 2 - LARGEUR_BULLE / 2),
    Math.max(12, window.innerWidth - LARGEUR_BULLE - 12),
  );

  const dernier = index === ETAPES.length - 1;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9800 }} role="dialog" aria-modal="true">
      {/* Le halo : un rectangle transparent dont l'ombre porte assombrit tout le
          reste. Un seul élément, pas quatre volets à faire coïncider. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          ...trou,
          borderRadius: 12,
          border: "1px solid var(--amber)",
          boxShadow: "0 0 0 9999px rgba(6,8,10,0.8), 0 0 22px rgba(255,180,84,0.35)",
          pointerEvents: "none",
          transition: "all 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      />

      <div
        className="lol-panel"
        style={{
          position: "fixed",
          left: bulleLeft,
          top: bulleTop,
          bottom: bulleBottom,
          width: LARGEUR_BULLE,
          maxWidth: "calc(100vw - 24px)",
          padding: "16px 18px",
          background: "var(--bg-raised, #14171C)",
          borderColor: "var(--line-strong)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span className="mono-num" style={{ fontSize: "0.66rem", color: "var(--amber)", letterSpacing: "0.1em" }}>
            {t.etape(index + 1, ETAPES.length)}
          </span>
          <button
            onClick={cloturer}
            aria-label={t.passer}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(152,162,176,0.5)", lineHeight: 1 }}
          >
            <Icone nom="croix" taille={15} />
          </button>
        </div>

        <h2 style={{
          fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
          fontSize: "1.05rem", color: "var(--bone)",
          letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6,
        }}>
          {etape.titre}
        </h2>
        <p style={{ fontSize: "0.82rem", lineHeight: 1.65, color: "rgba(236,239,244,0.6)" }}>
          {etape.texte}
        </p>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          {index > 0 && (
            <button
              onClick={() => setIndex((n) => n - 1)}
              style={{
                padding: "7px 13px", borderRadius: 999, cursor: "pointer", fontSize: "0.78rem",
                background: "transparent", border: "1px solid var(--line-strong)",
                color: "rgba(236,239,244,0.6)",
              }}
            >
              {t.precedent}
            </button>
          )}
          <button
            className="lol-btn text-sm"
            style={{ flex: 1 }}
            onClick={() => (dernier ? cloturer() : setIndex((n) => n + 1))}
          >
            {dernier ? t.terminer : t.suivant}
          </button>
        </div>

        {!dernier && (
          <button
            onClick={cloturer}
            style={{
              display: "block", margin: "10px auto 0", background: "none", border: "none",
              cursor: "pointer", fontSize: "0.72rem", color: "rgba(152,162,176,0.45)",
            }}
          >
            {t.passer}
          </button>
        )}
      </div>
    </div>
  );
}
