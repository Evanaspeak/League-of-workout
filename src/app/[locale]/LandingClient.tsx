import { Lien } from "@/components/Lien";
import { textes } from "@/lib/i18n/textes";
import { toLocale } from "@/lib/i18n/langues";
import { landing } from "@/lib/i18n/dictionaries/landing";
import { RevelationAuDefilement } from "@/components/RevelationAuDefilement";
import { Wordmark } from "@/components/Wordmark";
import { BandeJeux } from "@/components/landing/BandeJeux";
import { BoucleDemo } from "@/components/landing/BoucleDemo";
import { VideoFond } from "@/components/landing/VideoFond";
import type { VideoBoucle } from "@/lib/videoBoucle";
import { CadreApp } from "@/components/landing/CadreApp";
import { LogoWindows } from "@/components/landing/LogoOS";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { JEUX } from "@/lib/jeux";

export default function LandingClient({
  isLoggedIn, telechargement, version, logosJeux, video, locale,
}: {
  isLoggedIn: boolean;
  /** L'installeur de la dernière version, résolu côté serveur. */
  telechargement: string;
  version: string | null;
  /** Les logos de jeux présents dans le dépôt : code du jeu → nom de fichier. */
  logosJeux: Record<string, string>;
  /** La vidéo de démonstration, si le fichier a été déposé. */
  video: VideoBoucle | null;
  /** La langue vient de l'adresse : c'est ce qui permet le rendu au serveur. */
  locale: string;
}) {
  const t = textes(landing, toLocale(locale));

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
      {/* Le seul script de cette page : il révèle les sections au défilement
          et ne connaît aucun de ses textes. */}
      <RevelationAuDefilement />

      {/* NAV */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(12,14,17,0.85)", backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid var(--line)",
      }}>
        <div className="wow-nav" style={{ maxWidth: 1200, margin: "0 auto", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Lien href="/" style={{ textDecoration: "none", display: "inline-flex" }}>
            <Wordmark fontSize="var(--marque-nav)" />
          </Lien>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <LanguageSwitcher />
            <Lien href={isLoggedIn ? "/dashboard" : "/login"} className="wow-ghost wow-ghost-nav">
              {isLoggedIn ? t.navLoggedIn : t.navLoggedOut}
            </Lien>
          </div>
        </div>
      </nav>

      {/* ══ HERO ══════════════════════════════════════════════════════════
          Les deux halos flous qui traînaient ici sont partis : ils ne
          disaient rien, ils brouillaient le texte, et une page qui doit
          convaincre en trois secondes n'a pas de place pour de la décoration
          qui ne porte aucun sens. Ce qui remplit le cadre à droite est
          désormais le produit lui-même.                                     */}
      <section className={`hero-section${video ? " hero-video" : ""}`}>
        {video && (
          <VideoFond
            sources={video.sources}
            affiche={video.affiche}
            titre={t.videoTitre}
            lecture={t.videoLecture}
            pause={t.videoPause}
          />
        )}
        <div className="wow-hero">
          {/* Colonne texte */}
          <div className="hero-col-texte">
            <h1 className="hero-rise hero-titre" style={{ animationDelay: "0.12s" }}>
              <span className="hero-titre-l1">{t.heroTitleLine1}</span>
              <span className="brand-fire hero-titre-l2">{t.heroTitleLine2}</span>
            </h1>

            <p className="hero-rise hero-sous" style={{ animationDelay: "0.2s" }}>
              {t.heroSubtitle(JEUX.length)}
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
              <Lien href={isLoggedIn ? "/dashboard" : "/beta"} className="wow-ghost hero-ghost">
                {isLoggedIn ? t.navLoggedIn : t.heroBeta}
              </Lien>
            </div>

            <p className="hero-rise hero-note" style={{ animationDelay: "0.38s" }}>
              {t.heroTelechargerNote}
            </p>
          </div>

          {/* Colonne produit : une capture réelle du tableau de bord, dans une
              fenêtre. C'est la première chose que le visiteur voit du logiciel,
              et il n'y en avait aucune.
              Quand une vidéo tourne derrière, elle montre déjà le produit en
              usage : une capture par-dessus ferait deux images concurrentes
              dans le même cadre. La colonne se retire, et les captures de la
              galerie plus bas continuent de faire la preuve. */}
          {!video && (
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
          )}
        </div>
      </section>

      {/* ══ BANDE DES JEUX ═══════════════════════════════════════════════ */}
      <section className="section-jeux">
        <div className="reveal">
          <BandeJeux legende={t.jeuxLegende} logos={logosJeux} />
        </div>
      </section>

      {/* ══ LA BOUCLE ════════════════════════════════════════════════════ */}
      <section className="section-boucle">
        <div className="conteneur reveal">
          <h2 style={{ ...h2, marginBottom: 20 }}>{t.boucleTitre}</h2>
          <BoucleDemo temps={t.boucleTemps} legende={t.boucleLegende} aria={t.boucleAria} libelles={t.boucleVignettes} />
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
            <Lien href={isLoggedIn ? "/dashboard" : "/beta"} className="wow-ghost hero-ghost">
              {isLoggedIn ? t.navLoggedIn : t.ctaBeta}
            </Lien>
          </div>
          <p className="hero-note" style={{ marginTop: 18 }}>{t.heroTelechargerNote}</p>

        </div>
      </section>
    </div>
  );
}
