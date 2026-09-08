import { layout } from "@/lib/i18n/dictionaries/layout";
import { textes } from "@/lib/i18n/textes";
import type { Locale } from "@/lib/i18n/langues";

/**
 * Ce que dit une adresse qui ne mène nulle part.
 *
 * Le bloc vit à part parce qu'il est rendu depuis DEUX coquilles : la page
 * `/{langue}/introuvable`, à l'intérieur de la mise en page du site, et la
 * frontière `not-found` de la racine, qui n'a ni mise en page ni feuille de
 * style et fournit donc son propre document. Écrit deux fois, il divergerait
 * à la première correction — c'est le motif que ce projet paie en boucle.
 *
 * Les styles sont en ligne, et c'est ce qui rend les deux emplois possibles :
 * le bloc se rend à l'identique avec ou sans la feuille de style du site.
 */
export function CorpsIntrouvable({ locale }: { locale: Locale }) {
  const t = textes(layout, locale);
  return (
    <div style={{ maxWidth: 460, margin: "0 auto", padding: "48px 24px", textAlign: "center" }}>
      <p style={{ color: "#98A2B0", letterSpacing: "0.2em", fontFamily: "ui-monospace, monospace" }}>404</p>
      <h1 style={{ fontSize: "clamp(1.4rem, 5vw, 2rem)", margin: "12px 0", textWrap: "balance" }}>
        {t.introuvableTitre}
      </h1>
      <p style={{ color: "#98A2B0", lineHeight: 1.6 }}>{t.introuvableTexte}</p>
      <p style={{ marginTop: 28 }}>
        {/* L'adresse sans préfixe négocie la langue d'elle-même. */}
        {/*
          Une balise `a` et non `Lien`, parce que ce bloc est rendu depuis la
          frontière `not-found` de la RACINE, qui n'a ni mise en page ni
          fournisseur de routeur : un composant de navigation Next y lèverait.
          C'est la même raison qui met les styles en ligne, deux lignes plus
          haut. Le rechargement complet que ça coûte est sans objet ici — on
          quitte une page qui n'existe pas.
        */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/" style={{
          display: "inline-block", padding: "12px 28px", textDecoration: "none",
          border: "1px solid #C8AA6E", color: "#C8AA6E", borderRadius: 4,
        }}>
          {t.introuvableRetour}
        </a>
      </p>
    </div>
  );
}
