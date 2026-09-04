import { ImageResponse } from "next/og";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { chargerRatios } from "@/lib/exercicesConfig";
import { jourDansFuseau } from "@/lib/fuseau";
import { calculerBilan, JOURS_SAISON, type Bilan } from "@/lib/bilanSaison";
import { repartirPoints, toExerciceIds, ventiler } from "@/lib/exercices";
import { motsImage, type MotsImage } from "@/lib/i18n/imageBilan";
import { estLocale, etiquetteLocale } from "@/lib/i18n/langues";

/**
 * Le bilan de saison, en image.
 *
 * Une image se poste sur Discord, dans une conversation, sur un réseau. Une
 * page ne se poste pas — elle demande à celui d'en face de cliquer, et il ne
 * clique pas. C'est toute la différence entre un bilan qu'on montre et un
 * bilan qu'on garde.
 *
 * Elle est rendue **au serveur** et non capturée dans le navigateur : une
 * capture d'écran dépend de la taille de la fenêtre, du thème, des polices
 * installées, et rend une image différente à chaque appareil. Ici, le même
 * compte donne toujours la même image.
 *
 * Aucune adresse publique : l'image se lit avec la session de son propriétaire,
 * qui l'enregistre et la partage lui-même. Rendre les statistiques de
 * quelqu'un lisibles par une adresse est une décision qui se prend, pas un
 * effet de bord.
 */

const OR = "#C8AA6E";
const FOND = "#0C0E11";
const ACIER = "#98A2B0";

/** Grand nombre et sa légende. */
function Chiffre({ valeur, legende }: { valeur: string; legende: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ fontSize: 62, fontWeight: 700, color: OR, lineHeight: 1 }}>{valeur}</div>
      <div style={{ fontSize: 21, color: ACIER, textTransform: "uppercase", letterSpacing: 2 }}>
        {legende}
      </div>
    </div>
  );
}

function carte(
  bilan: Bilan, pseudo: string, effortPaye: string, mots: MotsImage, etiquette: string,
) {
  // Dates et nombres passent par `Intl` : « 2026-05-25 → 2026-08-23 » se lit
  // comme une sortie de base de données, pas comme un bilan qu'on montre.
  const jour = (j: string) => {
    const [a, m, d] = j.split("-").map(Number);
    return new Intl.DateTimeFormat(etiquette, { day: "numeric", month: "short" })
      .format(new Date(Date.UTC(a, m - 1, d)));
  };
  const nombre = (n: number) => new Intl.NumberFormat(etiquette).format(n);
  // Le français veut une espace fine insécable avant le « % », l'anglais
  // aucune. `Intl` connaît la règle de chaque langue ; nous, non.
  const pourcent = (n: number) =>
    new Intl.NumberFormat(etiquette, { style: "percent" }).format(n / 100);

  return (
    <div
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "64px 72px", background: FOND,
        backgroundImage:
          "radial-gradient(ellipse 70% 55% at 85% 0%, rgba(200,170,110,0.16) 0%, rgba(12,14,17,0) 62%)",
        color: "#E8EAED", fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 26, color: ACIER, letterSpacing: 3, textTransform: "uppercase" }}>
          {`${mots.periode(JOURS_SAISON)} · ${jour(bilan.debut)} → ${jour(bilan.fin)}`}
        </div>
        <div style={{ fontSize: 66, fontWeight: 700, color: "#FFFFFF" }}>{pseudo}</div>
      </div>

      <div style={{ display: "flex", gap: 76 }}>
        <Chiffre valeur={nombre(bilan.parties)} legende={mots.parties} />
        <Chiffre valeur={bilan.winrate === null ? "—" : pourcent(bilan.winrate)}
                 legende={mots.winrate} />
        <Chiffre valeur={effortPaye} legende={mots.paye} />
        <Chiffre valeur={nombre(bilan.meilleureSerie)} legende={mots.serie} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ fontSize: 24, color: ACIER }}>
          {bilan.jeuPrincipal ? bilan.jeuPrincipal.nom : "—"}
        </div>
        <div style={{ fontSize: 24, color: OR, letterSpacing: 2 }}>WIN OR WORKOUT</div>
      </div>
    </div>
  );
}

export async function GET() {
  await chargerRatios();
  const user = await getCurrentUser();
  // Pas de session, pas d'image. Une image de bilan est une donnée du compte
  // comme une autre, même si elle est faite pour être montrée.
  if (!user) return new Response("Non authentifié", { status: 401 });

  const maintenant = new Date();
  const depuis = new Date(maintenant.getTime() - JOURS_SAISON * 24 * 60 * 60 * 1000);
  const jourDe = (d: Date) => jourDansFuseau(d, user.fuseau);

  const [parties, paiements] = await Promise.all([
    // `sansEnjeu: false`, comme la page. La même requête était écrite deux
    // fois et une seule des deux filtrait : l'IMAGE comptait les parties
    // refusées que la page juste à côté écarte, donc deux chiffres pour la
    // même saison — et c'est l'image qu'on partage. Ce fichier était invisible
    // au garde qui l'aurait dit : il ne lisait que `route.ts`.
    prisma.game.findMany({
      where: { userId: user.id, sansEnjeu: false, date: { gte: depuis } },
      select: { date: true, result: true, pompesCalculees: true, jeu: true, champion: true },
    }),
    prisma.paiement.findMany({
      where: { userId: user.id, jour: { gte: jourDe(depuis) } },
      select: { points: true, jour: true },
    }),
  ]);

  const bilan = calculerBilan(parties, paiements, jourDe(depuis), jourDe(maintenant), jourDe);
  // « 4 200 points » ne dit rien à personne. La quantité réelle, dans les
  // exercices du compte, en dit quelque chose.
  const etiquette = etiquetteLocale(estLocale(user.langue) ? user.langue : "en");
  const parts = ventiler(repartirPoints(bilan.pointsPayes, toExerciceIds(user.exercices)), null, etiquette);
  const effortPaye = parts.map((p) => p.valeur).join(" + ") || "0";

  return new ImageResponse(
    carte(bilan, user.pseudo, effortPaye, motsImage(user.langue), etiquette),
    {
      width: 1200,
      height: 630,
      headers: {
        // L'image change dès qu'une partie s'ajoute : elle ne se met pas en
        // cache. Et elle porte des données de compte — jamais dans un cache
        // partagé.
        "Cache-Control": "private, no-store",
      },
    },
  );
}
