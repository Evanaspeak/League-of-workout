"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useT } from "@/lib/i18n/LocaleContext";
import { visite as dict } from "@/lib/i18n/dictionaries/visite";
import { estPagePublique } from "@/lib/pagesPubliques";
import { Icone } from "@/components/Icone";
import { cleOnboarding, cleVisite } from "@/lib/premiereVisite";
import { useIdCompte } from "@/lib/useIdCompte";

/**
 * Visite guidée de la première connexion.
 *
 * La modale d'accueil explique ce que fait le produit ; elle ne dit pas OÙ sont
 * les choses. On arrivait donc sur un tableau de bord complet sans savoir par
 * quoi commencer — et le rail, la fonction la plus utile au quotidien, est
 * justement celle qu'on ne remarque pas.
 *
 * La visite éclaire les vrais éléments de l'écran et traverse les trois pages
 * de l'application. Elle pointe ce qui est réellement là, pas une capture :
 * elle ne peut donc pas se désynchroniser de l'interface. Les ancres sont des
 * attributs `data-visite` ; une ancre introuvable fait sauter l'étape plutôt
 * que casser la visite.
 *
 * ── Sur la fluidité ──
 * Le piège, quand on enchaîne les étapes, est de tout retirer de l'écran le
 * temps de mesurer la suivante : on obtient un clignotement à chaque clic. Ici
 * le halo et la bulle restent affichés sur l'ancienne position et se déplacent
 * vers la nouvelle par une transition — l'écran ne se vide jamais. C'est le
 * cadre affiché, et non l'étape visée, qui décide de ce qu'on lit : les deux
 * changent donc ensemble, d'un seul mouvement.
 */

// Les marques de première visite portent le compte : voir l'article de
// `premiereVisite.ts`. Un navigateur déjà servi ne doit pas priver un compte
// neuf de sa visite.

/** Marge autour de l'élément éclairé, en pixels. */
const MARGE = 8;
/** Au-delà, on considère que l'ancre ne viendra pas. */
// Une ancre présente est désormais vue dès qu'elle paraît, par l'observateur :
// ce délai ne sert plus qu'aux ancres qui ne viendront jamais. Cinq secondes
// d'écran figé pour rien, c'était trop long pour l'œil.
const ATTENTE_MAX_MS = 3000;
/** Durée pendant laquelle on suit l'élément, le temps que le défilement finisse. */
const SUIVI_MS = 700;

type Etape = {
  /** Valeur de `data-visite` à éclairer. */
  cle: string;
  titre: string;
  texte: string;
  /** Page où vit l'ancre. La visite s'y rend d'elle-même. */
  chemin?: string;
  /**
   * Ancre de remplacement sur écran étroit, où le rail est replié derrière son
   * bouton et où ses actions n'ont aucune surface à l'écran.
   */
  cleEtroite?: string;
  /**
   * Ancre de repli quand la principale n'existe pas encore : la pastille de
   * dette n'apparaît qu'une fois qu'on doit quelque chose, et les graphiques
   * qu'après quelques parties. Sans elle, ces étapes se sautaient — pour un
   * compte neuf, c'est-à-dire pour le seul public de cette visite.
   */
  cleSecours?: string;
};

type Cadre = { i: number; left: number; top: number; width: number; height: number };

/**
 * Surface de l'élément, ou `null` s'il n'en occupe aucune.
 *
 * Un test « est-il dans l'écran ? » vivait ici, et c'est lui qui faisait sauter
 * des étapes. Le chercheur s'en servait pour décider si l'ancre EXISTE : tout
 * ce qui se trouvait sous la ligne de flottaison lui était donc invisible —
 * alors que c'est précisément ce qu'on allait amener à l'écran juste après.
 * L'étape attendait cinq secondes une ancre pourtant présente, puis se sautait
 * elle-même. Reste le seul critère qui compte : occuper des pixels. Un rail
 * replié ou une section non dépliée n'en occupe aucun, et l'éclairer
 * désignerait le vide.
 */
function mesurer(el: Element): Omit<Cadre, "i"> | null {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export function VisiteGuidee() {
  const t = useT(dict);
  const chemin = usePathname();
  const routeur = useRouter();

  const ETAPES: Etape[] = [
    { cle: "rail", cleEtroite: "rail-bascule", chemin: "/dashboard", titre: t.railTitre, texte: t.railTexte },
    { cle: "rail-session", cleEtroite: "rail-bascule", titre: t.sessionTitre, texte: t.sessionTexte },
    { cle: "rail-ajout", cleEtroite: "rail-bascule", titre: t.ajoutTitre, texte: t.ajoutTexte },
    { cle: "dette", cleEtroite: "rail-bascule", cleSecours: "dette-carte", titre: t.detteTitre, texte: t.detteTexte },
    { cle: "stats", titre: t.statsTitre, texte: t.statsTexte },
    { cle: "graphique", cleSecours: "stats-globales", titre: t.graphiqueTitre, texte: t.graphiqueTexte },
    { cle: "nav-history", titre: t.navHistoriqueTitre, texte: t.navHistoriqueTexte },
    { cle: "historique-table", chemin: "/history", titre: t.historiqueTitre, texte: t.historiqueTexte },
    { cle: "nav-settings", titre: t.navReglagesTitre, texte: t.navReglagesTexte },
    { cle: "rubrique-effort", chemin: "/settings", titre: t.reglagesEffortTitre, texte: t.reglagesEffortTexte },
    { cle: "rubrique-jeux", titre: t.reglagesJeuxTitre, texte: t.reglagesJeuxTexte },
    { cle: "rubrique-profil", titre: t.finTitre, texte: t.finTexte },
  ];

  const [active, setActive] = useState(false);
  const [cible, setCible] = useState(0);
  /**
   * Cadre RÉELLEMENT affiché. Il porte son étape : tant que la suivante n'est
   * pas mesurée, c'est l'ancienne qu'on continue de voir, et rien ne clignote.
   */
  const [cadre, setCadre] = useState<Cadre | null>(null);
  const cibleRef = useRef(0);

  const uid = useIdCompte();
  /** Incrémenté quand l'accueil se ferme : c'est ce qui relance l'examen. */
  const [relance, setRelance] = useState(0);

  useEffect(() => {
    const surFin = () => setRelance((n) => n + 1);
    window.addEventListener("low:accueil-termine", surFin);
    return () => window.removeEventListener("low:accueil-termine", surFin);
  }, []);

  useEffect(() => {
    if (estPagePublique(chemin)) return;
    if (uid === undefined) return;
    if (localStorage.getItem(cleVisite(uid))) return;
    // La visite prend la suite de l'accueil : tant qu'il n'a pas été vu, il n'y
    // a rien à guider.
    if (!localStorage.getItem(cleOnboarding(uid))) return;
    // Assez pour laisser la modale finir de s'effacer, pas plus.
    const minuteur = setTimeout(() => setActive(true), 250);
    return () => clearTimeout(minuteur);
  }, [chemin, uid, relance]);

  const cloturer = useCallback(() => {
    localStorage.setItem(cleVisite(uid), "1");
    setActive(false);
    setCadre(null);
  }, [uid]);

  /**
   * Vise l'ancre de l'étape courante : va sur sa page s'il le faut, attend
   * qu'elle apparaisse, l'amène à l'écran, puis la suit le temps que le
   * défilement se termine — sans quoi le halo se poserait là où l'élément
   * était et non là où il arrive.
   */
  useEffect(() => {
    const i = cible;
    const etape = ETAPES[i];
    if (!active || !etape) return;
    cibleRef.current = i;

    const etroit = window.innerWidth < 900;
    const cles = [
      ...(etroit && etape.cleEtroite ? [etape.cleEtroite] : []),
      etape.cle,
      ...(etape.cleSecours ? [etape.cleSecours] : []),
    ];
    const debut = Date.now();
    let annule = false;
    let minuteur: ReturnType<typeof setTimeout>;
    let image = 0;

    const trouver = () => {
      for (const cle of cles) {
        const el = document.querySelector(`[data-visite="${cle}"]`);
        if (el) {
          const m = mesurer(el);
          if (m) return { el, m };
        }
      }
      return null;
    };

    /** Recolle le halo sur l'élément à chaque image, le temps du défilement. */
    const suivre = (el: Element, jusqua: number) => {
      if (annule || cibleRef.current !== i) return;
      const m = mesurer(el);
      if (m) setCadre({ i, ...m });
      if (Date.now() < jusqua) image = requestAnimationFrame(() => suivre(el, jusqua));
    };

    let fini = false;
    let observateur: MutationObserver | null = null;
    const arreter = () => {
      fini = true;
      observateur?.disconnect();
      clearTimeout(minuteur);
    };

    /** Renvoie vrai quand il n'y a plus rien à attendre pour cette étape. */
    const tenter = () => {
      if (fini || annule || cibleRef.current !== i) return true;
      const trouve = trouver();
      if (trouve) {
        arreter();
        trouve.el.scrollIntoView({ block: "center", behavior: "smooth" });
        suivre(trouve.el, Date.now() + SUIVI_MS);
        return true;
      }
      if (Date.now() - debut > ATTENTE_MAX_MS) {
        // Ancre introuvable : l'étape n'a rien à montrer, on passe — et si
        // c'était la dernière, la visite s'achève.
        arreter();
        if (i + 1 >= ETAPES.length) cloturer();
        else setCible((n) => (n === i ? i + 1 : n));
        return true;
      }
      return false;
    };

    // Le changement de page part d'ici : l'ancre n'existera qu'après.
    if (etape.chemin && chemin !== etape.chemin) routeur.push(etape.chemin);

    // L'ancre arrive quand la page a fini de se peindre — après une navigation,
    // après un chargement de données. On réagit à sa VENUE plutôt que de la
    // découvrir au battement suivant : c'est ce qui faisait qu'une étape
    // pouvait se faire attendre des secondes alors que sa cible était là.
    observateur = new MutationObserver(() => { tenter(); });
    observateur.observe(document.body, { childList: true, subtree: true });

    // Le battement reste, en second rideau : une ancre peut apparaître sans
    // mutation du DOM (dépliage par style, image qui se charge et donne enfin
    // une hauteur à son conteneur).
    const boucle = () => {
      if (tenter()) return;
      minuteur = setTimeout(boucle, 120);
    };
    // Tout passe par un minuteur, y compris la première recherche : rien ne
    // doit poser d'état dans la foulée du rendu.
    minuteur = setTimeout(boucle, 0);

    return () => {
      annule = true;
      arreter();
      cancelAnimationFrame(image);
    };
    // Les étapes sont reconstruites à chaque rendu (les libellés viennent des
    // traductions) mais leur contenu ne change pas d'un rendu à l'autre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, cible, chemin, cloturer, routeur]);

  // L'élément éclairé bouge avec la page : on resuit sa position.
  useEffect(() => {
    if (!active) return;
    const resuivre = () => {
      const i = cibleRef.current;
      const etape = ETAPES[i];
      if (!etape) return;
      const etroit = window.innerWidth < 900;
      const cles = [
        ...(etroit && etape.cleEtroite ? [etape.cleEtroite] : []),
        etape.cle,
        ...(etape.cleSecours ? [etape.cleSecours] : []),
      ];
      for (const cle of cles) {
        const el = document.querySelector(`[data-visite="${cle}"]`);
        const m = el && mesurer(el);
        if (m) { setCadre({ i, ...m }); return; }
      }
    };
    window.addEventListener("resize", resuivre);
    window.addEventListener("scroll", resuivre, true);
    return () => {
      window.removeEventListener("resize", resuivre);
      window.removeEventListener("scroll", resuivre, true);
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

  // Ce qu'on LIT suit ce qu'on VOIT : l'étape affichée est celle du cadre en
  // place, pas celle qu'on est en train de rejoindre.
  const etape = cadre ? ETAPES[cadre.i] : null;
  if (!active || !cadre || !etape) return null;

  const affiche = cadre.i;
  const dernier = affiche === ETAPES.length - 1;

  const trou = {
    left: Math.max(4, cadre.left - MARGE),
    top: Math.max(4, cadre.top - MARGE),
    width: cadre.width + MARGE * 2,
    height: cadre.height + MARGE * 2,
  };

  // La bulle se place sous le halo s'il reste de la place, au-dessus sinon.
  const LARGEUR_BULLE = 340;
  const dessous = trou.top + trou.height + 300 < window.innerHeight;
  const bulleTop = dessous ? trou.top + trou.height + 14 : undefined;
  const bulleBottom = dessous ? undefined : Math.max(12, window.innerHeight - trou.top + 14);
  const bulleLeft = Math.min(
    Math.max(12, trou.left + trou.width / 2 - LARGEUR_BULLE / 2),
    Math.max(12, window.innerWidth - LARGEUR_BULLE - 12),
  );

  const glisse = "0.42s cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9800 }} role="dialog" aria-modal="true">
      {/* Le halo : un rectangle transparent dont l'ombre portée assombrit tout
          le reste. Un seul élément, pas quatre volets à faire coïncider — et
          donc une seule chose à animer. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          ...trou,
          borderRadius: 12,
          border: "1px solid var(--amber)",
          boxShadow: "0 0 0 9999px rgba(6,8,10,0.82), 0 0 26px rgba(255,180,84,0.35)",
          pointerEvents: "none",
          transition: `left ${glisse}, top ${glisse}, width ${glisse}, height ${glisse}`,
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
          transition: `left ${glisse}, top ${glisse}, bottom ${glisse}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
          {/* Une pastille par étape : on voit d'un coup d'œil ce qui reste,
              ce qu'un « 3 / 12 » seul ne montre pas. */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }} aria-hidden>
            {ETAPES.map((_, i) => (
              <span
                key={i}
                style={{
                  width: i === affiche ? 14 : 5, height: 5, borderRadius: 999,
                  background: i <= affiche ? "var(--amber)" : "rgba(152,162,176,0.28)",
                  transition: `width 0.3s ease, background 0.3s ease`,
                }}
              />
            ))}
          </div>
          <button
            onClick={cloturer}
            aria-label={t.passer}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--faint)", lineHeight: 1, flexShrink: 0 }}
          >
            <Icone nom="croix" taille={15} />
          </button>
        </div>

        {/* La clé fait remonter un remplacement de nœud à chaque étape : le
            texte apparaît en fondu au lieu de se substituer d'un coup. */}
        <div key={affiche} style={{ animation: "visiteEntree 0.32s ease both" }}>
          <span className="mono-num" style={{ fontSize: "0.62rem", color: "var(--faint)", letterSpacing: "0.1em" }}>
            {t.etape(affiche + 1, ETAPES.length)}
          </span>
          <h2 style={{
            fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
            fontSize: "1.05rem", color: "var(--bone)",
            letterSpacing: "0.06em", textTransform: "uppercase", margin: "3px 0 6px",
          }}>
            {etape.titre}
          </h2>
          <p style={{ fontSize: "0.82rem", lineHeight: 1.65, color: "var(--muted)" }}>
            {etape.texte}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
          {affiche > 0 && (
            <button
              onClick={() => setCible(affiche - 1)}
              style={{
                padding: "7px 13px", borderRadius: 999, cursor: "pointer", fontSize: "0.78rem",
                background: "transparent", border: "1px solid var(--line-strong)",
                color: "var(--muted)",
              }}
            >
              {t.precedent}
            </button>
          )}
          <button
            className="lol-btn text-sm"
            style={{ flex: 1 }}
            onClick={() => (dernier ? cloturer() : setCible(affiche + 1))}
          >
            {dernier ? t.terminer : t.suivant}
          </button>
        </div>

        {!dernier && (
          <button
            onClick={cloturer}
            style={{
              display: "block", margin: "10px auto 0", background: "none", border: "none",
              cursor: "pointer", fontSize: "0.72rem", color: "var(--faint)",
            }}
          >
            {t.passer}
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes visiteEntree {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          div { transition: none !important; animation: none !important; }
        }
      `}</style>
    </div>
  );
}
