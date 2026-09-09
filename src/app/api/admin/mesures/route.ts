import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estAdmin } from "@/lib/admin";
import { calculerMesures, equilibreJeux, type CompteMesure } from "@/lib/mesures";
import { compterDemandes } from "@/lib/demandeJeu";
import { JEUX } from "@/lib/jeux";
import { SEUIL_SEMAINE } from "@/lib/veille";

/**
 * Ce que le produit fait vraiment, chiffré.
 *
 * Deux questions restées sans réponse faute d'instrument : combien de temps
 * entre l'inscription et la première partie, et combien de personnes
 * reviennent. On répondait « aucune idée ».
 *
 * La lecture charge tous les comptes. À cent utilisateurs c'est sans objet ; à
 * dix mille il faudra passer par des agrégats en base. Le seuil est noté ici
 * pour qu'on s'en souvienne avant que la page ne devienne lente.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !estAdmin(user.email)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const comptes = await prisma.user.findMany({
    select: {
      createdAt: true,
      games: {
        // La date d'ENREGISTREMENT, pas celle de la partie : une partie
        // rattrapée se date la veille, et le délai en ressortait négatif.
        select: { createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const mesures: CompteMesure[] = comptes.map((c) => {
    const jours = new Set(
      c.games.map((g) => g.createdAt.toISOString().slice(0, 10)),
    );
    return {
      cree: c.createdAt,
      premierePartie: c.games[0]?.createdAt ?? null,
      joursActifs: jours.size,
    };
  });

  /**
   * Les comptes dont le volume sort de l'ordinaire.
   *
   * L'application réclame de l'effort après une défaite : elle peut servir à
   * se punir. Le message de prévention part côté joueur ; celui-ci est le
   * pendant discret, pour que quelqu'un puisse regarder. Aucun nom d'utilisateur
   * n'est nécessaire pour décider s'il faut regarder — le pseudo suffit à
   * retrouver le compte dans la liste voisine.
   */
  const semaine = new Date(Date.now() - 7 * 86_400_000);
  const gros = await prisma.user.findMany({
    where: { games: { some: { date: { gte: semaine } } } },
    select: {
      pseudo: true,
      games: { where: { date: { gte: semaine } }, select: { pompesCalculees: true } },
    },
  });
  const veille = gros
    .map((u) => ({
      pseudo: u.pseudo,
      points: u.games.reduce((t, g) => t + Math.max(0, g.pompesCalculees), 0),
    }))
    .filter((u) => u.points >= SEUIL_SEMAINE)
    .sort((a, b) => b.points - a.points)
    .slice(0, 20);

  /**
   * Ce que chaque jeu coûte en moyenne (réponse 185).
   *
   * Seuls les jeux comptés à la PARTIE entrent dans la comparaison : le coût
   * d'un jeu compté au temps est une fonction de sa durée, donc le comparer au
   * coût d'un match reviendrait à comparer une soirée à dix minutes. Et les
   * parties SANS ENJEU sont écartées : elles valent zéro par construction, et
   * elles tireraient la moyenne d'un jeu vers le bas sans que personne ait
   * moins payé.
   */
  const parJeu = await prisma.game.groupBy({
    by: ["jeu"],
    where: {
      sansEnjeu: false,
      jeu: { in: JEUX.filter((j) => j.type === "parties").map((j) => j.nom) },
    },
    _count: { _all: true },
    _avg: { pompesCalculees: true },
  });
  const equilibre = equilibreJeux(parJeu.map((g) => ({
    jeu: g.jeu ?? "",
    parties: g._count._all,
    moyenne: Math.round((g._avg.pompesCalculees ?? 0) * 10) / 10,
  })));

  /**
   * Les jeux qu'on nous demande (réponse 180) : « ça décide de la suite ».
   *
   * Le texte est libre et n'est lu QUE ici — jamais par un autre utilisateur.
   * Le compte est un compte de personnes, l'unicité étant posée en base.
   */
  const demandes = compterDemandes(
    await prisma.demandeJeu.findMany({ select: { nom: true, cle: true } }),
  );

  /**
   * Combien de comptes portent une montre (réponse 035).
   *
   * C'est la seule chose que la question sert à savoir, et elle décide de
   * quelque chose : brancher un service tiers coûte deux nuits (réponses 037
   * et 042), et ça ne se décide pas sur une intuition. Les TROIS états sont
   * rendus — « pas répondu » n'est ni un oui ni un non, et le confondre avec
   * l'un des deux fausserait la proportion dans le sens qu'on aurait choisi.
   *
   * Un `groupBy` plutôt que trois comptages : une seule lecture, et la
   * troisième valeur ne peut pas diverger des deux autres.
   */
  const parMontre = await prisma.user.groupBy({
    by: ["montre"],
    _count: { _all: true },
  });
  const montres = {
    oui: parMontre.find((g) => g.montre === true)?._count._all ?? 0,
    non: parMontre.find((g) => g.montre === false)?._count._all ?? 0,
    sansReponse: parMontre.find((g) => g.montre === null)?._count._all ?? 0,
  };

  return NextResponse.json({
    ...calculerMesures(mesures), veille, seuilSemaine: SEUIL_SEMAINE, equilibre,
    demandesJeux: demandes, montres,
  });
}
