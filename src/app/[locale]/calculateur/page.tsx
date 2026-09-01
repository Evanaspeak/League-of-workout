import type { Metadata } from "next";
import { metadonneesPage } from "@/lib/i18n/metadonnees";
import { toLocale } from "@/lib/i18n/langues";
import { Lien } from "@/components/Lien";
import { tousLesSlugs } from "@/lib/slugJeu";
import { textes } from "@/lib/i18n/textes";
import { calculateur } from "@/lib/i18n/dictionaries/calculateur";

export async function generateMetadata(
  { params }: { params: Promise<{ locale: string }> },
): Promise<Metadata> {
  const { locale } = await params;
  return metadonneesPage("calculateur", toLocale(locale), "/calculateur");
}

/** L'entrée du calculateur : une porte par jeu. */
export default async function IndexCalculateur(
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const t = textes(calculateur, toLocale(locale));
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }} className="flex flex-col gap-6">
      <div>
        <h1 style={{
          fontFamily: "var(--font-heading)", fontSize: "clamp(1.6rem, 6vw, 2.2rem)",
          lineHeight: 1.2, textWrap: "balance",
        }}>
          {t.indexTitre}
        </h1>
        <p style={{ color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
          {t.indexIntro}
        </p>
      </div>

      <div className="lol-panel p-5" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tousLesSlugs().map(({ slug, nom }) => (
          <Lien
            key={slug}
            href={`/calculateur/${slug}`}
            style={{ display: "block", padding: "6px 0", borderBottom: "1px solid var(--line)" }}
          >
            {nom}
          </Lien>
        ))}
      </div>
    </div>
  );
}
