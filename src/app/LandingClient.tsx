"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n/LocaleContext";
import { landing } from "@/lib/i18n/dictionaries/landing";
import { Wordmark } from "@/components/Wordmark";
import { Icone } from "@/components/Icone";
import { PastilleOverlay } from "@/components/landing/PastilleOverlay";
import { ScenePartie } from "@/components/landing/ScenePartie";
import { BandeJeux } from "@/components/landing/BandeJeux";
import { BoucleDemo } from "@/components/landing/BoucleDemo";
import { CadreApp } from "@/components/landing/CadreApp";
import { LogoWindows } from "@/components/landing/LogoOS";
import { useMouvementReduit } from "@/lib/valeurClient";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/* Chaque icône a sa couleur — la palette vit dans le contenu */
const ICON_COLORS: Record<string, string> = {
  home: "var(--amber)",
  layers: "var(--violet)",
  zap: "var(--amber)",
  target: "var(--signal)",
  brain: "var(--violet)",
  heart: "var(--ember)",
};

/* Reveal au scroll : ajoute .is-visible aux éléments .reveal quand ils entrent */
function useRevealOnScroll() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ── Icônes SVG (stroke, style unique — pas d'emoji) ─────────────────────── */
function Icon({ name, size = 20, color = "var(--steel)" }: { name: string; size?: number; color?: string }) {
  const paths: Record<string, React.ReactNode> = {
    home: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </>
    ),
    layers: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 17 9 5 9-5" />
      </>
    ),
    zap: <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />,
    target: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1" />
      </>
    ),
    brain: (
      <>
        <path d="M9.5 3A2.5 2.5 0 0 0 7 5.5a3 3 0 0 0-2.2 5A3.5 3.5 0 0 0 6.5 21H11V3H9.5Z" />
        <path d="M14.5 3A2.5 2.5 0 0 1 17 5.5a3 3 0 0 1 2.2 5A3.5 3.5 0 0 1 17.5 21H13V3h1.5Z" />
      </>
    ),
    heart: <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.3a5 5 0 1 1 7.5 6.3Z" />,
    chaise: (
      <>
        <path d="M6 4v9h9V4" />
        <path d="M15 13H4v3h11" />
        <path d="M6 16v4M15 16v4" />
      </>
    ),
    coeur: <path d="M19.5 12.6 12 20l-7.5-7.4A5 5 0 1 1 12 6.3a5 5 0 1 1 7.5 6.3Z" />,
    horloge: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </>
    ),
  };
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden
    >
      {paths[name] ?? null}
    </svg>
  );
}

/* Petit slash ember — le "or" de la marque, utilisé comme puce */
function Slash({ height = 12 }: { height?: number }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        width: Math.max(2, Math.round(height / 5)),
        height,
        background: "var(--ember)",
        transform: "skewX(-18deg)",
        borderRadius: 1,
        flexShrink: 0,
      }}
    />
  );
}

/* ── Le feed de dette : la soirée facturée, game par game ────────────────── */
/** `r` vaut V/W, D/L, ou N pour une session au temps, qui ne se gagne ni ne se perd. */
type FeedEntry = { r: string; jeu: string; detail: string; pts: number };

function DebtFeed({
  title, count, totalLabel, unit, conversion, entries,
}: {
  title: string; count: string; totalLabel: string; unit: string;
  /** Ce que le total donne dans chaque exercice : le modèle en une ligne. */
  conversion: string;
  entries: FeedEntry[];
}) {
  const HOLD_STEPS = 3; // temps de pause une fois la soirée complète
  const [step, setStep] = useState(0);
  const mouvementReduit = useMouvementReduit();

  useEffect(() => {
    // Animation refusée par le système : le compteur ne sert plus à rien, la
    // soirée s'affiche entière et l'intervalle n'est jamais lancé.
    if (mouvementReduit) return;
    const id = setInterval(() => {
      // Après la pause, on repart directement sur la première game (pas de trou vide)
      setStep((prev) => (prev >= entries.length + HOLD_STEPS ? 1 : prev + 1));
    }, 950);
    return () => clearInterval(id);
  }, [entries.length, mouvementReduit]);

  const visible = mouvementReduit ? entries.length : Math.min(step, entries.length);
  const total = entries.slice(0, visible).reduce((s, e) => s + e.pts, 0);
  const complet = visible === entries.length;

  return (
    <div style={{
      background: "var(--carbon)",
      border: "1px solid var(--line)",
      borderRadius: 16,
      overflow: "hidden",
      width: "100%",
      maxWidth: 440,
    }}>
      {/* Header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "14px 20px", borderBottom: "1px solid var(--line)",
      }}>
        <span className="eyebrow">{title}</span>
        <span className="mono-num" style={{ fontSize: "0.7rem", color: "var(--faint)" }}>{count}</span>
      </div>

      {/* Rows */}
      <div>
        {entries.map((e, i) => {
          const isWin = e.r === "V" || e.r === "W";
          // Une session au temps n'a ni victoire ni défaite : elle reste neutre.
          const isNeutre = e.r === "N";
          const teinte = isNeutre ? "var(--steel)" : isWin ? "var(--victory)" : "var(--loss)";
          const fond = isNeutre
            ? "rgba(152,162,176,0.1)"
            : isWin ? "var(--victory-soft)" : "rgba(255,90,71,0.1)";
          const bord = isNeutre
            ? "rgba(152,162,176,0.3)"
            : isWin ? "rgba(47,217,138,0.3)" : "rgba(255,90,71,0.3)";
          const shown = i < visible;
          return (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 20px",
                borderBottom: "1px solid var(--line)",
                opacity: shown ? 1 : 0,
                transform: shown ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 0.35s ease, transform 0.35s ease",
              }}
            >
              <span
                className="mono-num"
                style={{
                  width: 26, height: 26, borderRadius: 6, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", fontWeight: 600,
                  color: teinte,
                  background: fond,
                  border: `1px solid ${bord}`,
                }}
              >
                {isNeutre ? "·" : e.r}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: "0.85rem", color: "var(--bone)", fontWeight: 500 }}>{e.jeu}</span>
                <span className="mono-num" style={{ display: "block", fontSize: "0.68rem", color: "var(--faint)" }}>{e.detail}</span>
              </span>
              <span className="mono-num" style={{
                fontSize: "0.95rem", fontWeight: 600,
                color: isWin ? "var(--victory)" : "var(--ember)",
              }}>
                +{e.pts}
              </span>
            </div>
          );
        })}
      </div>

      {/* Total, puis ce qu'il donne dans chaque exercice : la conversion est le
          produit, autant la montrer dès l'accueil. */}
      <div style={{ padding: "16px 20px", background: "rgba(255,77,46,0.05)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span className="eyebrow">{totalLabel}</span>
          <span className="mono-num" style={{ fontSize: "1.5rem", fontWeight: 600, color: "var(--ember)", lineHeight: 1 }}>
            {total} <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "rgba(255,77,46,0.7)" }}>{unit}</span>
          </span>
        </div>
        <div
          className="mono-num"
          style={{
            fontSize: "0.7rem", color: "var(--faint)", textAlign: "right", marginTop: 6,
            opacity: complet ? 1 : 0,
            transition: "opacity 0.4s ease",
          }}
        >
          {conversion}
        </div>
      </div>
    </div>
  );
}

/* ── Landing ─────────────────────────────────────────────────────────────── */
export default function LandingClient({
  isLoggedIn, telechargement, version, logosJeux,
}: {
  isLoggedIn: boolean;
  /** L'installeur de la dernière version, résolu côté serveur. */
  telechargement: string;
  version: string | null;
  /** Les logos de jeux réellement présents dans le dépôt, constatés au rendu. */
  logosJeux: string[];
}) {
  const t = useT(landing);
  useRevealOnScroll();

  const h2: React.CSSProperties = {
    fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.015em",
    fontSize: "clamp(1.9rem, 3.4vw, 2.7rem)",
    lineHeight: 1.05,
    color: "var(--bone)",
  };

  return (
    <div className="full-bleed accueil" style={{
      background: "var(--ink)",
      color: "var(--bone)",
      marginTop: "-1.5rem",
      marginBottom: "-1.5rem",
    }}>

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(12,14,17,0.85)", backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--line)",
      }}>
        <div className="wow-nav" style={{ maxWidth: 1200, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Link href="/" style={{ textDecoration: "none", display: "inline-flex" }}>
            <Wordmark fontSize="var(--marque-nav)" />
          </Link>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <LanguageSwitcher />
            <Link href={isLoggedIn ? "/dashboard" : "/login"} className="wow-ghost wow-ghost-nav">
              {isLoggedIn ? t.navLoggedIn : t.navLoggedOut}
            </Link>
          </div>
        </div>
      </nav>

      {/* ══ HERO ══════════════════════════════════════════════════════════
          Les deux halos flous qui traînaient ici sont partis : ils ne
          disaient rien, ils brouillaient le texte, et une page qui doit
          convaincre en trois secondes n'a pas de place pour de la décoration
          qui ne porte aucun sens. Ce qui remplit le cadre à droite est
          désormais le produit lui-même.                                     */}
      <section className="hero-section">
        <div className="wow-hero">
          {/* Colonne texte */}
          <div className="hero-col-texte">
            <span className="hero-rise hero-badge" style={{ animationDelay: "0.05s" }}>
              <span className="hero-badge-point" />
              <span className="eyebrow">{t.heroBadge}</span>
            </span>

            <h1 className="hero-rise hero-titre" style={{ animationDelay: "0.12s" }}>
              <span className="hero-titre-l1">{t.heroTitleLine1}</span>
              <span className="brand-fire hero-titre-l2">{t.heroTitleLine2}</span>
            </h1>

            <p className="hero-rise hero-sous" style={{ animationDelay: "0.2s" }}>
              {t.heroSubtitle}
            </p>

            {/* Le bouton principal est un bouton de téléchargement, et il en a
                l'air : le logo de la plateforme répond avant le texte à la
                seule question qui compte — est-ce que ça tourne chez moi ?
                Le lien pointait auparavant sur une page intermédiaire, en
                caractères gris soulignés, sous les deux vrais boutons. */}
            <div className="hero-rise hero-actions" style={{ animationDelay: "0.3s" }}>
              <a href={telechargement} className="cta-telecharger" data-visite="telecharger">
                <LogoWindows taille={20} />
                <span className="cta-telecharger-texte">
                  {t.heroTelecharger}
                  {version && <em>{t.heroVersion(version)}</em>}
                </span>
              </a>
              <Link href={isLoggedIn ? "/dashboard" : "/beta"} className="wow-ghost hero-ghost">
                {isLoggedIn ? t.navLoggedIn : t.heroBeta}
              </Link>
            </div>

            <p className="hero-rise hero-note" style={{ animationDelay: "0.38s" }}>
              {t.heroTelechargerNote}
            </p>
          </div>

          {/* Colonne produit : une capture réelle du tableau de bord, dans une
              fenêtre. C'est la première chose que le visiteur voit du logiciel,
              et il n'y en avait aucune. */}
          <div className="wow-hero-visuel hero-rise" style={{ animationDelay: "0.26s" }}>
            <CadreApp
              src="/images/produit/dashboard.png"
              alt={t.heroApercuAlt}
              titre={t.heroApercuTitre}
              largeur={1880}
              hauteur={688}
              priorite
              tailles="(max-width: 960px) 100vw, 620px"
            />
          </div>
        </div>
      </section>

      {/* ══ BANDE DES JEUX ═══════════════════════════════════════════════ */}
      <section className="section-jeux">
        <p className="eyebrow section-jeux-titre">{t.jeuxTitre}</p>
        <BandeJeux legende={t.jeuxLegende} logos={logosJeux} />
      </section>

      {/* ══ LA BOUCLE ════════════════════════════════════════════════════ */}
      <section className="section-boucle">
        <div className="conteneur">
          <p className="eyebrow" style={{ marginBottom: 16 }}>{t.boucleEyebrow}</p>
          <h2 style={{ ...h2, marginBottom: 12 }}>{t.boucleTitre}</h2>
          <p className="section-intro">{t.boucleSoustitre}</p>
          <BoucleDemo temps={t.boucleTemps} legende={t.boucleLegende} aria={t.boucleAria} libelles={t.boucleVignettes} />
        </div>
      </section>

      {/* ══ LE PRODUIT, EN CAPTURES ══════════════════════════════════════ */}
      <section className="section-produit">
        <div className="conteneur">
          <p className="eyebrow" style={{ marginBottom: 16 }}>{t.produitEyebrow}</p>
          <h2 style={{ ...h2, marginBottom: 12 }}>{t.produitTitre}</h2>
          <p className="section-intro">{t.produitSoustitre}</p>

          <div className="galerie">
            {t.produitCaptures.map((c, i) => (
              <figure key={c.image} className={`galerie-item reveal${i === 2 ? " galerie-item-etroit" : ""}`} style={{ transitionDelay: `${i * 90}ms` }}>
                <CadreApp
                  src={c.image}
                  alt={c.alt}
                  titre={c.cadre}
                  largeur={c.largeur}
                  hauteur={c.hauteur}
                  tailles={i === 2 ? "(max-width: 960px) 70vw, 300px" : "(max-width: 960px) 100vw, 700px"}
                />
                <figcaption>
                  <strong>{c.titre}</strong>
                  <span>{c.legende}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>


      {/* ══ UNE DETTE, TROIS MONNAIES ════════════════════════════════════ */}
      <section className="section-payer">
        <div className="conteneur">
          <div className="payer-grille">
            <div>
              <p className="eyebrow" style={{ marginBottom: 16 }}>{t.payEyebrow}</p>
              <h2 style={{ ...h2, marginBottom: 12 }}>{t.payTitle}</h2>
              <p className="section-intro" style={{ marginBottom: 26 }}>{t.paySubtitle}</p>

              <p className="eyebrow" style={{ marginBottom: 14 }}>{t.payUnitLabel}</p>
              <div className="bande-tarifs">
                {t.payModes.map((m, i) => (
                  <div key={m.name} className="reveal tarif" style={{ transitionDelay: `${i * 100}ms` }}>
                    <div className="tarif-entete">
                      <Icon name={m.icon} size={18} color={ICON_COLORS[m.icon] ?? "var(--steel)"} />
                      <span>{m.name}</span>
                    </div>
                    <p className="mono-num tarif-valeur">{m.valeur}</p>
                    <p className="tarif-desc">{m.desc}</p>
                  </div>
                ))}
              </div>
              <p className="payer-partage">{t.payShareNote}</p>
            </div>

            {/* Une soirée qui se remplit sous les yeux : le même relevé que
                dans l'application, et la conversion en bas. */}
            <div className="payer-feed reveal">
              <DebtFeed
                title={t.feedTitle}
                count={t.feedCount}
                totalLabel={t.feedTotalLabel}
                unit={t.feedPointsUnit}
                conversion={t.feedConversion}
                entries={t.feedEntries}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ══ L'APP DESKTOP ET SON OVERLAY ═════════════════════════════════ */}
      <section className="section-desktop">
        <div className="conteneur payer-grille">
          <div className="desktop-scene reveal">
            <ScenePartie
              etiquette={t.overlayEtiquette}
              pastille={
                <PastilleOverlay
                  temps={t.pastilleTemps}
                  soiree={t.pastilleSoiree}
                  jeu={t.pastilleJeu}
                  kda={t.pastilleKda}
                  kdaValeur={t.pastilleKdaValeur}
                  siGagne={t.pastilleSiGagne}
                  siPerdu={t.pastilleSiPerdu}
                  gagne={t.pastilleGagne}
                  perdu={t.pastillePerdu}
                />
              }
            />
            <p className="desktop-legende">{t.overlayLegende}</p>
          </div>
          <div>
            <p className="eyebrow" style={{ marginBottom: 16 }}>{t.featuresEyebrow}</p>
            <h2 style={{ ...h2, marginBottom: 28 }}>{t.featuresTitle}</h2>
            <div className="liste-features">
              {t.features.slice(0, 6).map((f, i) => (
                <div key={f.title} className="reveal feature" style={{ transitionDelay: `${i * 70}ms` }}>
                  {/* Le nom à gauche, ce qu'il fait à droite : une feuille de
                      spécifications se lit en deux colonnes, pas en vignettes. */}
                  <div className="feature-titre"><Slash height={12} />{f.title}</div>
                  <div className="feature-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ LE PROBLÈME ══════════════════════════════════════════════════
          Les chiffres s'enchaînaient en paragraphes, sans respiration : on
          les lisait comme un mur. Chacun tient désormais dans son propre
          bloc, avec un pictogramme et une jauge qui le rend comparable. */}
      <section className="section-probleme">
        <div className="conteneur">
          <p className="eyebrow" style={{ marginBottom: 16 }}>{t.problemEyebrow}</p>
          <h2 style={{ ...h2, marginBottom: 20, maxWidth: "18ch" }}>
            {t.problemTitleLine1}<br />{t.problemTitleLine2}{" "}
            <span style={{ color: "var(--ember)" }}>{t.problemTitleHighlight}</span>
          </h2>
          <p className="section-intro" style={{ maxWidth: "62ch" }}>{t.problemPara1}</p>

          <div className="infographie">
            {t.stats.map((s, i) => (
              <div key={s.value} className="info-carte reveal" style={{ transitionDelay: `${i * 80}ms` }}>
                <Icon name={INFO_ICONES[i] ?? "horloge"} size={20} color={INFO_TEINTES[i] ?? "var(--amber)"} />
                <div className="mono-num info-val" style={{ color: INFO_TEINTES[i] ?? "var(--amber)" }}>{s.value}</div>
                <p className="info-label">{s.label}</p>
              </div>
            ))}
          </div>

          <p className="section-note">{t.problemPara2}</p>
        </div>
      </section>

      {/* ══ CTA FINAL ════════════════════════════════════════════════════ */}
      <section className="section-cta">
        <div className="reveal" style={{ maxWidth: 720, margin: "0 auto" }}>
          <h2 className="cta-titre">
            <span className="brand-fire" style={{ paddingBottom: "0.08em" }}>{t.ctaTitle}</span>
          </h2>
          <p className="cta-sous">{t.ctaSubtitle}</p>
          <div className="cta-actions">
            <a href={telechargement} className="cta-telecharger cta-telecharger-grand">
              <LogoWindows taille={22} />
              <span className="cta-telecharger-texte">
                {t.heroTelecharger}
                {version && <em>{t.heroVersion(version)}</em>}
              </span>
            </a>
            <Link href={isLoggedIn ? "/dashboard" : "/beta"} className="wow-ghost hero-ghost">
              {isLoggedIn ? t.navLoggedIn : t.ctaBeta}
            </Link>
          </div>
          <p className="hero-note" style={{ marginTop: 18 }}>{t.heroTelechargerNote}</p>

          {/* Les sources restent accessibles, mais en bas : elles étayent le
              propos, elles ne sont pas le propos. */}
          <details className="sources">
            <summary>{t.sourcesTitle}</summary>
            <p className="sources-intro">{t.payFootnote}</p>
            <ul>
              {t.paySources.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer">
                    {(() => {
                      const mots = s.label.split(" ");
                      const dernier = mots.pop() ?? "";
                      return (
                        <>
                          {mots.length > 0 && `${mots.join(" ")} `}
                          <span style={{ whiteSpace: "nowrap" }}>
                            {dernier}
                            <Icone nom="lien-externe" taille={11} style={{ marginLeft: 5 }} />
                          </span>
                        </>
                      );
                    })()}
                  </a>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </section>
    </div>
  );
}

/** Un pictogramme et une teinte par constat : quatre chiffres alignés en
 *  colonne se lisaient comme une liste de courses. */
const INFO_ICONES = ["chaise", "horloge", "coeur", "zap"];
const INFO_TEINTES = ["var(--amber)", "var(--signal)", "var(--ember)", "var(--victory)"];
