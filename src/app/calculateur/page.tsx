import type { Metadata } from "next";
import Link from "next/link";
import { tousLesSlugs } from "@/lib/slugJeu";

export const metadata: Metadata = {
  title: "Combien de pompes pour une défaite ?",
  description:
    "Le calculateur de Win or Workout, jeu par jeu : réglez votre partie, obtenez le nombre "
    + "de pompes. Sans compte et sans inscription.",
  alternates: { canonical: "/calculateur" },
};

/** L'entrée du calculateur : une porte par jeu. */
export default function IndexCalculateur() {
  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }} className="flex flex-col gap-6">
      <div>
        <h1 style={{
          fontFamily: "var(--font-heading)", fontSize: "clamp(1.6rem, 6vw, 2.2rem)",
          lineHeight: 1.2, textWrap: "balance",
        }}>
          Combien de pompes pour une défaite ?
        </h1>
        <p style={{ color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
          Choisissez votre jeu. Le calcul est celui de l&apos;application, sans compte
          et sans inscription.
        </p>
      </div>

      <div className="lol-panel p-5" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {tousLesSlugs().map(({ slug, nom }) => (
          <Link
            key={slug}
            href={`/calculateur/${slug}`}
            style={{ display: "block", padding: "6px 0", borderBottom: "1px solid var(--line)" }}
          >
            {nom}
          </Link>
        ))}
      </div>
    </div>
  );
}
