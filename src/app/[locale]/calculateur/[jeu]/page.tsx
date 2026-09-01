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
 * Le catalogue reste fermé — mais c'est la PAGE qui referme, pas le routeur.
 *
 * Avec `dynamicParams = false`, un jeu inconnu rendait le 404 par défaut de
 * Next : `<html>` sans langue, « 404: This page could not be found. » en
 * anglais dans les six langues. La page 404 du site, traduite, n'était jamais
 * atteinte, parce que le routeur refusait l'adresse avant que la page ne
 * s'exécute.
 *
 * Ouvert, le rendu a lieu, `jeuDepuisSlug` ne trouve rien, et `notFound()`
 * rend la 404 du site dans la bonne langue. Les quinze jeux restent prérendus
 * par `generateStaticParams` : ce qui change n'est pas leur coût, c'est ce que
 * voit celui qui tape une adresse inventée.
 */
export const dynamicParams = true;
