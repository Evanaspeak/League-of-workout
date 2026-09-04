import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { estJourValide, jourLocal } from "@/lib/serie";
import { reponseBadges, reponseSerie } from "@/lib/progression";
import { composerExploits } from "@/lib/exploits";
import { avancementDefi, defiDuJour } from "@/lib/defiQuotidien";
import { debutDuMois, defisDuMois, moisDuJour } from "@/lib/defiMensuel";
import { composerCollectif } from "@/lib/objectifCollectif";
import { defisAAcquitter } from "@/lib/xpDefis";

/**
 * Les paliers et la série, en un seul aller-retour.
 *
 * `/api/badges` et `/api/serie` lisaient **la même requête** — les huit cents
 * derniers jours payés — chacune de son côté, à chaque chargement du tableau
 * de bord ET après chaque paiement, puisque les deux composants écoutent
 * `wow-dette-changee`. Quatre lectures identiques par soirée pour deux
 * réponses qui se déduisent l'une de l'autre.
 *
 * Les deux routes d'origine restent : leurs tests les couvrent, et une adresse
 * publiée ne se retire pas parce qu'on en a écrit une meilleure. Ce qui ne se
 * dédouble pas, c'est la mise en forme, sortie dans `src/lib/progression.ts`.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Le jour vient du navigateur : c'est le sien qui compte. Quelqu'un qui paie
  // à une heure du matin verrait sinon sa série comptée sur la veille ou le
  // lendemain, selon le fuseau du serveur.
  //
  // Le contrôle porte sur l'aller-retour et non sur la seule forme :
  // « 9999-99-99 » respecte le motif, n'est pas une date, et passait — il
  // rendait alors une série de zéro en court-circuitant le repli prévu pour
  // ce cas exact. La règle vit dans `estJourValide`, avec celle de
  // `/api/dashboard/daily` qui la portait seule.
  const demande = new URL(req.url).searchParams.get("jour");
  const aujourdhui = estJourValide(demande) ? demande : jourLocal();

  const prefixeDuMois = moisDuJour(aujourdhui);

  const [agregat, paiements, collectif, partiesDuMois, defisFaits] = await Promise.all([
    prisma.game.aggregate({
      // Même raison que dans `/api/badges`, dont cette route reprend le calcul.
      where: { userId: user.id, sansEnjeu: false },
      _sum: { pompesCalculees: true },
      _count: { _all: true },
    }),
    prisma.paiement.findMany({
      where: { userId: user.id },
      // `points` s'ajoute au MÊME select : le niveau se calcule sur l'effort
      // PAYÉ, et une colonne de plus sur une requête qu'on fait déjà ne coûte
      // rien, là où un agrégat séparé serait un aller-retour de plus vers Neon.
      select: { jour: true, points: true },
      // Une série ne remonte jamais bien loin, et la meilleure se recalcule sur
      // ce qu'on lit : deux ans de paiements quotidiens tiennent largement.
      orderBy: { jour: "desc" },
      take: 800,
    }),
    /**
     * Les parties du MOIS, une seule fois, pour les deux défis.
     *
     * Le défi du jour a besoin de celles d'aujourd'hui, ceux du mois de toutes
     * celles du mois. Le mois CONTIENT le jour : une requête suffit, et la
     * journée se découpe ensuite en mémoire. Deux requêtes auraient coûté deux
     * allers-retours vers Neon pour des lignes dont l'une est un sous-ensemble
     * de l'autre.
     *
     * Les bornes sont en UTC, comme dans `/api/dashboard/daily` qui découpe
     * déjà les journées ainsi. C'est une approximation pour qui joue loin du
     * méridien — et c'est la MÊME dans les deux endroits, ce qui vaut mieux
     * qu'une seconde règle qui divergerait à la première correction.
     */
    /**
     * L'objectif collectif (ligne 133) : la seule lecture du produit qui ne
     * filtre PAS par compte.
     *
     * Ce qui en sort est une somme et un décompte sur tout le monde — aucun
     * pseudo, aucune ligne, rien qui désigne quelqu'un. C'est ce qui rend la
     * dispense acceptable, et c'est écrit là où le garde la lit.
     *
     * `_count.userId` compte les LIGNES de paiement, pas les comptes
     * distincts ; le nombre de contributeurs se compte donc à part, sur les
     * groupes. Un `groupBy` rendrait autant de lignes que de comptes actifs,
     * ce qui est acceptable à cette échelle et cesserait de l'être à dix
     * mille — le jour venu, ce sera un compteur tenu à l'écriture.
     */
    prisma.paiement.groupBy({
      by: ["userId"],
      where: prefixeDuMois
        ? { jour: { gte: `${prefixeDuMois}-01`, lte: aujourdhui } }
        : { jour: aujourdhui },
      _sum: { points: true },
    }),
    prisma.game.findMany({
      where: {
        userId: user.id,
        sansEnjeu: false,
        date: {
          gte: debutDuMois(aujourdhui) ?? new Date(`${aujourdhui}T00:00:00.000Z`),
          lte: new Date(`${aujourdhui}T23:59:59.999Z`),
        },
      },
      select: { result: true, jeu: true, date: true },
    }),
    /**
     * L'XP déjà gagnée sur des défis, sommée depuis les LIGNES.
     *
     * Jamais un total rangé quelque part : une somme ne peut pas diverger de
     * ce qui la produit, un compteur si. C'est le raisonnement de `Paiement`,
     * appliqué à la seconde chose de la progression qui se stocke.
     */
    prisma.defiAccompli.aggregate({
      where: { userId: user.id },
      _sum: { xp: true },
    }),
  ]);

  const source = {
    totalPoints: agregat._sum.pompesCalculees ?? 0,
    parties: agregat._count._all ?? 0,
    jours: paiements.map((p) => p.jour),
    pointsPayes: paiements.reduce((somme, p) => somme + p.points, 0),
    xpDefis: defisFaits._sum.xp ?? 0,
  };

  const paiementsDuJour = paiements.filter((p) => p.jour === aujourdhui);
  const partiesDuJour = partiesDuMois.filter(
    (g) => g.date.toISOString().slice(0, 10) === aujourdhui,
  );
  const defi = avancementDefi(defiDuJour(aujourdhui), {
    partiesDuJour: partiesDuJour.length,
    victoiresDuJour: partiesDuJour.filter((g) => g.result === "V").length,
    jeuxDuJour: new Set(partiesDuJour.map((g) => g.jeu).filter(Boolean)).size,
    pointsPayesDuJour: paiementsDuJour.reduce((somme, p) => somme + p.points, 0),
    seancesDuJour: paiementsDuJour.length,
  });
  const defisMois = defisDuMois({
    pointsPayesDuMois: prefixeDuMois
      ? paiements
        .filter((p) => p.jour.startsWith(prefixeDuMois) && p.jour <= aujourdhui)
        .reduce((somme, p) => somme + p.points, 0)
      : 0,
    partiesDuMois: partiesDuMois.length,
  });

  /**
   * Retenir les défis qui viennent d'être remplis.
   *
   * **C'est une écriture depuis un GET, et ça se justifie.** L'alternative
   * serait d'écrire depuis `/api/games` et `/api/dette`, les deux routes qui
   * font bouger les chiffres — mais il faudrait y recalculer l'avancement des
   * défis, donc écrire une seconde fois une règle qui vit ici. C'est le défaut
   * que ce projet paie le plus souvent, et il coûte plus cher qu'un `INSERT`
   * sur une route de lecture.
   *
   * Elle est inoffensive parce qu'elle est IDEMPOTENTE en base : l'unicité
   * porte sur (compte, défi, période), donc deux onglets ouverts en même temps
   * n'écrivent qu'une ligne. `skipDuplicates` en fait un geste sans effet dès
   * le second passage.
   *
   * Elle se pose en DERNIER et son échec ne coûte que lui-même : ce qui se
   * rattrape au prochain chargement passe après ce qui ne se rattrape pas.
   * C'est un `try` et non un `.catch()`, qui ne rattraperait qu'une promesse
   * rejetée et pas un jet synchrone — exactement ce que produirait une méthode
   * absente d'une doublure.
   */
  const aRetenir = defisAAcquitter(aujourdhui, prefixeDuMois ?? "", defi, defisMois);
  if (aRetenir.length > 0) {
    try {
      await prisma.defiAccompli.createMany({
        data: aRetenir.map((d) => ({ userId: user.id, ...d })),
        skipDuplicates: true,
      });
    } catch { /* le défi se reretiendra au prochain chargement */ }
  }

  return NextResponse.json({
    badges: reponseBadges(source),
    serie: reponseSerie(source, aujourdhui, user),
    /**
     * Les exploits se lisent sur le COMPTE, déjà chargé par la session : ils
     * ne coûtent aucune requête. C'est ce qui rend acceptable de les ranger en
     * base plutôt que de les déduire — le prix se paie à l'écriture, une fois,
     * et jamais à la lecture.
     */
    exploits: composerExploits(user),
    /**
     * Le défi du jour, avec son avancement.
     *
     * Il vit ici et pas dans une route à lui pour la raison déjà écrite trois
     * fois dans ce fichier : il se mesure sur des lignes qu'on vient de lire.
     * Le tirage, lui, ne dépend que du JOUR — donc du navigateur, comme la
     * série, parce qu'un défi de vingt-quatre heures se compte sur les
     * vingt-quatre heures de celui qui le fait.
     */
    /**
     * Calculé PLUS HAUT, une seule fois, et lu ici comme par l'écriture qui
     * retient les défis remplis. Deux calculs du même avancement finiraient
     * par diverger — c'est le défaut que ce projet a payé huit fois — et ici
     * la divergence serait invisible : l'écran montrerait un défi rempli
     * pendant qu'aucune ligne ne serait écrite, ou l'inverse.
     */
    defi,
    /**
     * Les deux défis du mois (ligne 131).
     *
     * Le mois se lit sur le PRÉFIXE du jour côté paiements, qui portent déjà
     * une date locale, et sur la borne UTC côté parties, qui portent un
     * instant. Les deux découpages ne coïncident pas exactement, et c'est
     * assumé : c'est déjà le cas partout ailleurs, et une troisième règle
     * n'arrangerait rien.
     */
    /**
     * Ce que tout le monde a payé ce mois-ci, et à combien.
     *
     * Le décompte se fait sur les GROUPES et non sur les lignes : un compte
     * qui paie trois fois dans le mois est un contributeur, pas trois.
     */
    collectif: composerCollectif({
      points: collectif.reduce((somme, g) => somme + (g._sum.points ?? 0), 0),
      contributeurs: collectif.filter((g) => (g._sum.points ?? 0) > 0).length,
    }),
    // Même raison que le défi du jour : calculés une fois, lus deux.
    defisMois,
  });
}
