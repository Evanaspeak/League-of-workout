"use client";
import { Icone } from "@/components/Icone";
import { Lien } from "@/components/Lien";
import { useChemin } from "@/lib/i18n/useChemin";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/SessionContext";
import { useT } from "@/lib/i18n/LocaleContext";
import { estCheminPublic } from "@/lib/routesPubliques";
import { nav as navDict } from "@/lib/i18n/dictionaries/nav";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Wordmark } from "./Wordmark";
import { chargerCompte } from "@/lib/useIdCompte";

/**
 * Les liens de l'application se montrent à qui a un COMPTE, pas selon la page.
 *
 * Cette barre portait sa propre liste de pages publiques — `["/login", "/"]`,
 * deux entrées — alors que `routesPubliques.ts` en compte dix. Sur les huit
 * autres, dont `/telechargement`, `/cgu` et surtout les quinze pages du
 * CALCULATEUR, un visiteur sans compte voyait « Dashboard · Historique · Amis ·
 * Ta saison · Réglages » : cinq liens qui le renvoient tous à un écran de
 * connexion. Les pages du calculateur existent pour être trouvées par une
 * recherche — c'est-à-dire que le défaut tombait exactement sur les gens qui
 * arrivent, et sur eux seuls.
 *
 * C'est le troisième exemplaire d'une même règle, et la divergence est celle
 * que ce projet a déjà payée : deux listes de chemins publics avaient laissé
 * quatre routes partir en 307 vers `/login` pendant des semaines. La bonne
 * réponse n'est pas de recopier la liste une troisième fois, c'est de ne plus
 * poser la question au CHEMIN : ce qui décide, c'est d'avoir une session.
 *
 * Le chemin sert quand même, et pour éviter un scintillement : derrière la
 * porte, le middleware a déjà exigé une session, donc les liens partent au
 * premier rendu. Sur une page publique on ne sait pas encore, et on ne promet
 * rien avant de savoir.
 */
// Ces pages gèrent leur propre chrome (nav intégrée) : pas de double barre.
const SELF_CHROMED = ["/", "/beta", "/recuperation"];

export default function Nav() {
  const path = useChemin();
  const { sessionActive, sessionGames, countdown, polling, stopSession } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const [connecte, setConnecte] = useState(false);
  // Sous 720 px les liens ne tiennent plus sur une ligne et le dernier était
  // coupé à mi-mot : ils passent derrière un menu. Le chemin est mémorisé avec
  // l'état d'ouverture pour refermer le menu au changement de page — c'est le
  // motif React d'ajustement pendant le rendu, qui évite un effet en cascade.
  const [menu, setMenu] = useState({ ouvert: false, chemin: path });
  if (menu.chemin !== path) setMenu({ ouvert: false, chemin: path });
  const menuOuvert = menu.ouvert;
  const setMenuOuvert = (f: (o: boolean) => boolean) =>
    setMenu((m) => ({ ...m, ouvert: f(m.ouvert) }));
  const t = useT(navDict);

  const links = [
    { href: "/dashboard", label: t.dashboard },
    { href: "/history", label: t.historique },
    { href: "/amis", label: t.amis },
    { href: "/bilan", label: t.bilan },
    { href: "/settings", label: t.reglages },
  ];

  useEffect(() => {
    // C'est le serveur qui décide qui est administrateur : le navigateur ne
    // connaît pas la liste des adresses. La réponse est partagée avec les
    // autres composants qui ont besoin de savoir qui est connecté — sans quoi
    // la même question part trois à cinq fois par page.
    let obsolete = false;
    chargerCompte().then((u) => {
      if (obsolete) return;
      if (u) setConnecte(true);
      if (u?.estAdmin) setIsAdmin(true);
    });
    return () => { obsolete = true; };
  }, []);

  if (SELF_CHROMED.some((p) => (p === "/" ? path === "/" : path.startsWith(p)))) {
    return null;
  }

  const isPublic = estCheminPublic(path) && !connecte;

  return (
    <nav style={{
      background: "rgba(12,14,17,0.85)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      borderBottom: "1px solid var(--line)",
      position: "sticky",
      top: 0,
      zIndex: 40,
    }}>
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 h-14">
        <Lien
          href="/"
          style={{ textDecoration: "none", marginRight: "1.75rem", flexShrink: 0, display: "inline-flex" }}
        >
          <Wordmark fontSize="1.05rem" />
        </Lien>

        {!isPublic && (
          <button
            type="button"
            className="nav-burger"
            onClick={() => setMenuOuvert((o) => !o)}
            aria-expanded={menuOuvert}
            aria-label={menuOuvert ? t.fermerMenu : t.ouvrirMenu}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" aria-hidden>
              {menuOuvert
                ? <path d="M18 6 6 18M6 6l12 12" />
                : <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>}
            </svg>
          </button>
        )}

        {!isPublic && [...links, ...(isAdmin ? [{ href: "/admin", label: t.admin }] : [])].map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Lien
              key={l.href}
              href={l.href}
              className="nav-lien"
              data-visite={`nav-${l.href.replace("/", "")}`}
              style={{
                position: "relative",
                padding: "4px 10px",
                paddingBottom: 6,
                fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
                fontSize: "0.92rem",
                fontWeight: active ? 600 : 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: active ? "var(--bone)" : "var(--faint)",
                textDecoration: "none",
                transition: "color 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {l.label}
              {active && (
                <span style={{
                  position: "absolute",
                  bottom: 0,
                  left: 10,
                  right: 10,
                  height: 2,
                  background: "var(--ember)",
                  transform: "skewX(-18deg)",
                }} />
              )}
            </Lien>
          );
        })}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {!isPublic && sessionActive && (
            <>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "4px 12px",
              borderRadius: 999,
              background: "var(--victory-soft)",
              border: "1px solid rgba(47,217,138,0.3)",
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: "var(--victory)",
                animation: "pulse 1.5s ease-in-out infinite",
                display: "inline-block",
              }} />
              <span style={{ fontSize: "0.7rem", color: "var(--victory)", fontWeight: 700, letterSpacing: "0.06em" }}>{t.live}</span>
              <span className="mono-num" style={{ fontSize: "0.7rem", color: "var(--bone)" }}>{sessionGames.length}G</span>
              <span className="mono-num" style={{ fontSize: "0.7rem", color: "var(--faint)" }}>
                {polling ? <Icone nom="recharger" taille={13} /> : `${countdown}s`}
              </span>
            </div>
            <button
              onClick={stopSession}
              title={t.stopSession}
              aria-label={t.stopSession}
              style={{
                width: 28, height: 28,
                borderRadius: "50%",
                background: "rgba(255,90,71,0.12)",
                border: "1px solid rgba(255,90,71,0.3)",
                color: "var(--loss)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor" aria-hidden>
                <rect width="9" height="9" rx="1.5" />
              </svg>
            </button>
            </>
          )}
          <LanguageSwitcher />
        </div>
      </div>

      {/* Panneau déroulant du menu : uniquement sur petit écran, où les liens
          de la barre sont masqués. */}
      {!isPublic && menuOuvert && (
        <div className="nav-panneau">
          {[...links, ...(isAdmin ? [{ href: "/admin", label: t.admin }] : [])].map((l) => {
            const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Lien
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                style={{
                  display: "block",
                  padding: "13px 20px",
                  fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
                  fontSize: "1rem",
                  fontWeight: active ? 600 : 500,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: active ? "var(--bone)" : "var(--faint)",
                  textDecoration: "none",
                  borderLeft: `2px solid ${active ? "var(--ember)" : "transparent"}`,
                  borderBottom: "1px solid var(--line)",
                }}
              >
                {l.label}
              </Lien>
            );
          })}
        </div>
      )}
    </nav>
  );
}
