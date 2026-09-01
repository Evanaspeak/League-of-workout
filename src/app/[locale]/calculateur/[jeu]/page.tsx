import type { Metadata } from "next";
import { Lien } from "@/components/Lien";
import { notFound } from "next/navigation";
import { Calculateur } from "./Calculateur";
import { jeuDepuisSlug, tousLesSlugs } from "@/lib/slugJeu";
import { metadonneesJeu } from "@/lib/i18n/metadonnees";
import { textes } from "@/lib/i18n/textes";
import { calculateur } from "@/lib/i18n/dictionaries/calculateur";
import { toLocale } from "@/lib/i18n/langues";

/**
 * Une page par jeu, prérendue.
 *
 * Elle existe pour être trouvée : « combien de pompes pour une défaite sur
 * League of Legends » est une question que des gens tapent déjà, et à laquelle
 * personne ne répond. C'est le seul canal d'acquisition qui travaille sans
 * qu'on s'en occupe.
 *
 * Le titre de la page EST cette question. Un titre qui reformule ce que la
 * personne a cherché lui dit qu'elle est arrivée au bon endroit, avant même
 * qu'elle ait lu une ligne.
 */

export function generateStaticParams() {
  return tousLesSlugs().map(({ slug }) => ({ jeu: slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ jeu: string; locale: string }> },
): Promise<Metadata> {
  const { jeu: slug, locale } = await params;
  const jeu = jeuDepuisSlug(slug);
  if (!jeu) return { title: "Calculateur" };
  return metadonneesJeu(jeu, toLocale(locale), `/calculateur/${slug}`);
}

export default async function PageCalculateur(
  { params }: { params: Promise<{ jeu: string; locale: string }> },
) {
  const { jeu: slug, locale } = await params;
  const t = textes(calculateur, toLocale(locale));
  const jeu = jeuDepuisSlug(slug);
  // Une adresse inventée rend 404 plutôt qu'une page vide : c'est ce qu'attend
  // un moteur de recherche, et ça évite d'indexer des pages qui ne disent rien.
  if (!jeu) notFound();

  const autres = tousLesSlugs().filter((j) => j.slug !== slug).slice(0, 8);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }} className="flex flex-col gap-6">
      <h1 style={{
        fontFamily: "var(--font-heading)", fontSize: "clamp(1.5rem, 5vw, 2rem)",
        lineHeight: 1.2, textWrap: "balance",
      }}>
        {t.titre(jeu)}
      </h1>

      <Calculateur jeu={jeu} />

      <nav className="flex flex-col gap-2">
        <h2 className="titre-section">{t.autresJeux}</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          {autres.map((j) => (
            <Lien
              key={j.slug}
              href={`/calculateur/${j.slug}`}
              style={{ fontSize: "0.8rem", color: "var(--steel)", textDecoration: "underline" }}
            >
              {j.nom}
            </Lien>
          ))}
          <Lien
            href="/calculateur"
            style={{ fontSize: "0.8rem", color: "var(--gold)", textDecoration: "underline" }}
          >
            {t.tousLesJeux(tousLesSlugs().length)}
          </Lien>
        </div>
      </nav>
    </div>
  );
}

/**
 * Le catalogue est fermé, et c'est le ROUTEUR qui referme.
 *
 * Un jeu inconnu n'atteint jamais cette page : le routeur rejette l'adresse,
 * et une adresse rejetée par le routeur rend la 404 racine — celle du site,
 * dans la langue de l'adresse.
 *
 * Ouvrir le catalogue avait paru plus propre : la page se serait exécutée et
 * aurait appelé `notFound()`. Mesuré, c'est le contraire. Un `notFound()` levé
 * depuis une page cherche une frontière dans SON arbre de segments, n'en
 * trouve aucune faute de mise en page racine, et retombe sur la 404 intégrée
 * de Next — `<html>` sans langue, texte anglais. Les deux chemins ne se valent
 * pas, et seul celui-ci donne la bonne page.
 */
export const dynamicParams = false;
