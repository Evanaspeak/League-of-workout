import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calculateur } from "./Calculateur";
import { jeuDepuisSlug, tousLesSlugs } from "@/lib/slugJeu";

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
  { params }: { params: Promise<{ jeu: string }> },
): Promise<Metadata> {
  const { jeu: slug } = await params;
  const jeu = jeuDepuisSlug(slug);
  if (!jeu) return { title: "Calculateur" };

  const titre = `Combien de pompes pour une défaite sur ${jeu} ?`;
  const adresse = `https://winorworkout.com/calculateur/${slug}`;
  return {
    /**
     * `absolute` retire le suffixe « · Win or Workout » du gabarit.
     *
     * Le titre EST la question qu'on a tapée : c'est ce qui dit à la personne
     * qu'elle est arrivée au bon endroit. Avec le suffixe, la question
     * atteignait 75 caractères et Google la coupait — au milieu du nom du jeu,
     * c'est-à-dire au mot qui prouvait qu'on répondait bien à SA question.
     * Sans lui, quatorze pages sur quinze tiennent sous soixante caractères.
     */
    title: { absolute: titre },
    description:
      `Le calcul de Win or Workout pour ${jeu} : réglez votre partie, obtenez le nombre de pompes. `
      + "Sans compte et sans inscription.",
    alternates: { canonical: `/calculateur/${slug}` },
    /**
     * L'image et l'adresse sont redites ici, et il le faut.
     *
     * Next.js remplace le bloc `openGraph` du parent au lieu de le compléter :
     * déclarer un titre suffisait à faire disparaître l'image et l'adresse
     * héritées de la mise en page racine. Ces pages sont précisément celles
     * qu'on colle dans un salon Discord, et elles y arrivaient sans vignette.
     */
    openGraph: {
      title: titre,
      type: "website",
      url: adresse,
      siteName: "Win or Workout",
      images: ["/opengraph-image"],
    },
  };
}

export default async function PageCalculateur(
  { params }: { params: Promise<{ jeu: string }> },
) {
  const { jeu: slug } = await params;
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
        Combien de pompes pour une défaite sur {jeu} ?
      </h1>

      <Calculateur jeu={jeu} />

      <nav className="flex flex-col gap-2">
        <h2 className="titre-section">Les autres jeux</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          {autres.map((j) => (
            <Link
              key={j.slug}
              href={`/calculateur/${j.slug}`}
              style={{ fontSize: "0.8rem", color: "var(--steel)", textDecoration: "underline" }}
            >
              {j.nom}
            </Link>
          ))}
          <Link
            href="/calculateur"
            style={{ fontSize: "0.8rem", color: "var(--gold)", textDecoration: "underline" }}
          >
            {`Tous les jeux (${tousLesSlugs().length})`}
          </Link>
        </div>
      </nav>
    </div>
  );
}

// Le catalogue est fermé : une adresse hors liste rend 404 sans rendu à la
// demande, plutôt que d'ouvrir une page vide pour n'importe quelle chaîne.
export const dynamicParams = false;
