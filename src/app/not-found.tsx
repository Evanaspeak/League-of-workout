import { headers } from "next/headers";
import { layout } from "@/lib/i18n/dictionaries/layout";
import { toLocale } from "@/lib/i18n/langues";
import { textes } from "@/lib/i18n/textes";
import { EN_TETE_LANGUE } from "@/lib/i18n/cheminLocalise";

/**
 * La page qu'on obtient quand l'adresse ne mène nulle part.
 *
 * Elle vit à la RACINE, et il n'y a pas d'autre endroit possible. Sans mise en
 * page racine — elles sont deux, une par coquille, depuis que la langue est
 * dans l'adresse — `notFound()` ne consulte jamais la frontière posée sous
 * `[locale]` : il remonte jusqu'ici. Tant qu'il n'y avait rien, Next servait sa
 * propre 404, `<html>` sans langue et « 404: This page could not be found. » en
 * anglais pour les six langues.
 *
 * Trois tentatives ont échoué avant celle-ci — une frontière sous `[locale]`,
 * une frontière dans le segment attrape-tout, et la même rendue sans
 * `useLocale`. Aucune n'est consultée. C'est en lisant le HTML SERVI, et non la
 * page rendue dans un navigateur, qu'on s'en aperçoit : après hydratation React
 * finissait par afficher la bonne chose, et le test passait.
 *
 * Elle porte son propre `<html>` : une 404 racine sans mise en page racine doit
 * fournir le document entier.
 */
export default async function Introuvable() {
  // Le middleware pose la langue qu'il a négociée : c'est le seul endroit qui
  // la connaisse, puisqu'ici il n'y a plus de paramètre de route à lire.
  const locale = toLocale((await headers()).get(EN_TETE_LANGUE));
  const t = textes(layout, locale);

  return (
    <html lang={locale}>
      <body style={{
        margin: 0, minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#0B0E12", color: "#ECEFF4",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}>
        <div style={{ maxWidth: 460, padding: "0 24px", textAlign: "center" }}>
          <p style={{ color: "#98A2B0", letterSpacing: "0.2em", fontFamily: "ui-monospace, monospace" }}>404</p>
          <h1 style={{ fontSize: "clamp(1.4rem, 5vw, 2rem)", margin: "12px 0", textWrap: "balance" }}>
            {t.introuvableTitre}
          </h1>
          <p style={{ color: "#98A2B0", lineHeight: 1.6 }}>{t.introuvableTexte}</p>
          <p style={{ marginTop: 28 }}>
            {/* L'adresse sans préfixe négocie la langue d'elle-même. */}
            <a href="/" style={{
              display: "inline-block", padding: "12px 28px", textDecoration: "none",
              border: "1px solid #C8AA6E", color: "#C8AA6E", borderRadius: 4,
            }}>
              {t.introuvableRetour}
            </a>
          </p>
        </div>
      </body>
    </html>
  );
}
