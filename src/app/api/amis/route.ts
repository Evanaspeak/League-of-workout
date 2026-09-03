import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { validerPseudo } from "@/lib/identite";
import {
  decisionDemande,
  MAX_AMIS,
  MAX_DEMANDES_EN_ATTENTE,
} from "@/lib/social";

/**
 * Les amis : la liste, et la demande.
 *
 * Ce qui sort d'ici est choisi colonne par colonne. Une amitié donne accès à
 * un pseudo, pas à un compte — et `select` est la seule chose qui l'empêche :
 * `include: { demandeur: true }` publierait l'adresse électronique, le Riot
 * ID et le jeton de diffusion de quelqu'un d'autre. C'est la faute déjà
 * corrigée sur `/api/games`, un modèle plus loin, et elle se paierait ici bien
 * plus cher : ce ne sont plus les données de celui qui demande.
 */

const PERSONNE = { select: { id: true, pseudo: true } } as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [liens, groupes] = await Promise.all([
    prisma.amitie.findMany({
      where: { OR: [{ demandeurId: user.id }, { receveurId: user.id }] },
      select: {
        id: true,
        etat: true,
        demandeurId: true,
        receveurId: true,
        createdAt: true,
        demandeur: PERSONNE,
        receveur: PERSONNE,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.membreGroupe.findMany({
      where: { userId: user.id },
      select: {
        role: true,
        groupe: {
          select: {
            id: true,
            nom: true,
            code: true,
            _count: { select: { membres: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const autre = (l: { demandeurId: string; demandeur: { id: string; pseudo: string }; receveur: { id: string; pseudo: string } }) =>
    l.demandeurId === user.id ? l.receveur : l.demandeur;

  return NextResponse.json({
    /**
     * `lien` est l'identifiant de l'AMITIÉ, `id` celui de la personne. Les
     * deux servent et ne se confondent pas : l'un se passe à la route pour
     * accepter ou retirer, l'autre désignera le profil. Les avoir écrits tous
     * deux sous le nom `id` faisait silencieusement gagner le second.
     */
    amis: liens
      .filter((l) => l.etat === "acceptee")
      .map((l) => ({ lien: l.id, ...autre(l) })),
    /** Les demandes qu'on a reçues : ce sont les seules auxquelles on répond. */
    recues: liens
      .filter((l) => l.etat === "attente" && l.receveurId === user.id)
      .map((l) => ({ lien: l.id, ...l.demandeur })),
    /**
     * Celles qu'on a envoyées. Les montrer sert à deux choses : savoir qu'on
     * n'a pas oublié de demander, et pouvoir annuler — sans quoi une demande
     * partie par erreur reste pendante chez quelqu'un d'autre pour toujours.
     */
    envoyees: liens
      .filter((l) => l.etat === "attente" && l.demandeurId === user.id)
      .map((l) => ({ lien: l.id, ...l.receveur })),
    /**
     * Le code part à TOUS les membres, pas au seul propriétaire.
     *
     * C'est ce qui fait la différence entre un groupe et une liste : celui
     * qu'on a invité peut inviter à son tour. Le propriétaire garde ce qui
     * répare — refaire le code, donc révoquer celui qui circule.
     */
    groupes: groupes.map((m) => ({
      id: m.groupe.id,
      nom: m.groupe.nom,
      code: m.groupe.code,
      membres: m.groupe._count.membres,
      proprietaire: m.role === "proprietaire",
    })),
  });
}

/**
 * Demander une amitié, par pseudo exact.
 *
 * Pas de recherche partielle, pas de suggestion : le pseudo se connaît avant
 * de venir ici. Une liste de comptes qui se parcourt est un annuaire, et un
 * annuaire demande quelqu'un pour le surveiller (réponse 127).
 *
 * **Ce que cette route dit, et qu'on assume.** Un 404 apprend qu'aucun compte
 * ne porte ce pseudo, donc un 200 apprend l'inverse : on peut savoir, pseudo
 * par pseudo, qui a un compte. C'est une propriété connue, pas un oubli, et
 * pour deux raisons :
 *
 *  * l'inscription donne déjà cet oracle, en plus fort — « ce pseudo est déjà
 *    pris » est la réponse obligée de l'unicité, et on ne peut pas y renoncer ;
 *  * le fermer ici demanderait de rendre une faute de frappe indiscernable
 *    d'un envoi réussi, sur le chemin principal de la fonctionnalité. On
 *    échangerait un renseignement anodin — les pseudos ne sont secrets nulle
 *    part — contre une demande dont on ne sait jamais si elle est partie.
 *
 * Ce qui rouvrirait l'arbitrage : le jour où un pseudo cesse d'être public. Il
 * faudrait alors un budget de tentatives par compte, comme le limiteur de
 * l'inscription, et non une réponse floue.
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  let body: { pseudo?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps illisible" }, { status: 400 });
  }

  const verdict = validerPseudo(body.pseudo);
  if (!verdict.ok) return NextResponse.json({ error: verdict.erreur }, { status: verdict.statut });
  const pseudo = verdict.valeur;

  /**
   * L'unicité des pseudos vit dans l'application, pas en base : des doublons
   * existent déjà, et un index unique refuserait de se construire dessus. Deux
   * comptes peuvent donc porter le même pseudo — et alors on ne sait pas
   * lequel est visé. Prendre le premier enverrait la demande à la mauvaise
   * personne, ce qui est le seul résultat qu'on ne peut pas rattraper : elle
   * n'a aucun moyen de savoir qu'elle n'était pas la destinataire.
   */
  const candidats = await prisma.user.findMany({
    where: { pseudo: { equals: pseudo, mode: "insensitive" } },
    select: { id: true, pseudo: true },
    take: 2,
  });
  if (candidats.length === 0) {
    return NextResponse.json({ error: "Aucun joueur ne porte ce pseudo" }, { status: 404 });
  }
  if (candidats.length > 1) {
    return NextResponse.json({ error: "Plusieurs joueurs portent ce pseudo" }, { status: 409 });
  }
  const cible = candidats[0];

  const existantes = await prisma.amitie.findMany({
    where: {
      OR: [
        { demandeurId: user.id, receveurId: cible.id },
        { demandeurId: cible.id, receveurId: user.id },
      ],
    },
    select: { id: true, demandeurId: true, receveurId: true, etat: true },
  });

  const decision = decisionDemande(user.id, cible.id, existantes);
  if (decision.quoi === "soi-meme") {
    return NextResponse.json({ error: "On ne s'ajoute pas soi-même" }, { status: 400 });
  }
  if (decision.quoi === "deja-amis") {
    return NextResponse.json({ error: "Vous êtes déjà amis" }, { status: 409 });
  }
  if (decision.quoi === "deja-demande") {
    return NextResponse.json({ error: "Demande déjà envoyée" }, { status: 409 });
  }

  /**
   * L'autre m'avait déjà demandé : redemander ÉQUIVAUT à accepter.
   *
   * Créer une seconde ligne laisserait deux demandes croisées, chacun voyant
   * « en attente de sa réponse ». L'amitié ne pourrait plus se conclure, et
   * rien ne le signalerait : les deux écrans disent quelque chose de sensé.
   */
  if (decision.quoi === "accepter") {
    await prisma.amitie.updateMany({
      where: { id: decision.id, receveurId: user.id },
      data: { etat: "acceptee", accepteeLe: new Date() },
    });
    return NextResponse.json({ etat: "acceptee", pseudo: cible.pseudo });
  }

  const [amis, enAttente] = await Promise.all([
    prisma.amitie.count({
      where: { etat: "acceptee", OR: [{ demandeurId: user.id }, { receveurId: user.id }] },
    }),
    prisma.amitie.count({ where: { etat: "attente", demandeurId: user.id } }),
  ]);
  if (amis >= MAX_AMIS) {
    return NextResponse.json({ error: "Liste d'amis pleine" }, { status: 409 });
  }
  if (enAttente >= MAX_DEMANDES_EN_ATTENTE) {
    return NextResponse.json({ error: "Trop de demandes en attente" }, { status: 429 });
  }

  await prisma.amitie.create({
    data: { demandeurId: user.id, receveurId: cible.id },
  });
  return NextResponse.json({ etat: "attente", pseudo: cible.pseudo });
}
