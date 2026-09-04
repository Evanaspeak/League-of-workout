import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estGrosseSeance, FENETRE_JOURS } from "@/lib/grosseSeance";
import { motsSeance } from "@/lib/i18n/imageSeance";
import { estLocale, etiquetteLocale } from "@/lib/i18n/langues";
import { jourLocal } from "@/lib/serie";

/**
 * La dernière séance, en image (réponse 122).
 *
 * Une image se poste ; une page demande à celui d'en face de cliquer, et il ne
 * clique pas. C'est le même raisonnement que pour le bilan de saison, et le
 * même moteur.
 *
 * **Le chiffre vient de la BASE.** Le prendre dans l'adresse laisserait
 * n'importe qui fabriquer une image à douze mille points, et une image qu'on
 * peut écrire soi-même ne dit plus rien de personne — donc plus personne ne la
 * regarde.
 *
 * **Aucune adresse publique.** Elle se lit avec la session de son
 * propriétaire, qui l'enregistre et la partage lui-même. Rendre l'effort de
 * quelqu'un lisible par une adresse est une décision qui se prend, pas un
 * effet de bord du fait qu'on voulait une image.
 */

const OR = "#C8AA6E";
const FOND = "#0C0E11";
const ACIER = "#98A2B0";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Non authentifié", { status: 401 });

  const paiements = await prisma.paiement.findMany({
    where: { userId: user.id },
    select: { id: true, points: true, jour: true },
    orderBy: { createdAt: "desc" },
    take: 400,
  });
  const derniere = paiements[0];
  // Pas de séance, pas d'image. Rendre une image vide serait pire : on la
  // partagerait sans savoir qu'elle ne dit rien.
  if (!derniere) return new Response("Aucune séance", { status: 404 });

  const jourDebut = jourLocal(new Date(Date.now() - FENETRE_JOURS * 86_400_000));
  const record = estGrosseSeance(
    derniere.points,
    paiements.filter((p) => p.id !== derniere.id && p.jour >= jourDebut).map((p) => p.points),
  );

  const mots = motsSeance(user.langue);
  const etiquette = etiquetteLocale(estLocale(user.langue) ? user.langue : "en");
  const nombre = new Intl.NumberFormat(etiquette).format(derniere.points);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "64px 72px", background: FOND,
          backgroundImage:
            "radial-gradient(ellipse 70% 55% at 85% 0%, rgba(200,170,110,0.16) 0%, rgba(12,14,17,0) 62%)",
          color: "#E8EAED", fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 26, color: ACIER, textTransform: "uppercase", letterSpacing: 3 }}>
            {mots.titre}
          </div>
          <div style={{ fontSize: 54, fontWeight: 700, color: "#E8EAED" }}>
            {user.pseudo ?? ""}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 150, fontWeight: 700, color: OR, lineHeight: 1 }}>{nombre}</div>
          <div style={{ fontSize: 30, color: ACIER, textTransform: "uppercase", letterSpacing: 2 }}>
            {mots.paye}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          {/*
            La mention de record n'est là que si c'en est un : une image qui
            annoncerait « meilleure séance » à chaque fois ne voudrait rien
            dire, et celui qui la reçoit s'en apercevrait avant nous.
          */}
          <div style={{ fontSize: 26, color: record ? OR : "transparent" }}>
            {record ? mots.record(FENETRE_JOURS) : "."}
          </div>
          <div style={{ fontSize: 24, color: ACIER, letterSpacing: 2 }}>WIN OR WORKOUT</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
