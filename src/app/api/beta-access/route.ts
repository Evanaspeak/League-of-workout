import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordAttempt, getClientIp } from "@/lib/rate-limit";
import { autoriserAdresse } from "@/lib/porteBeta";
import { normaliserEmail, pseudoDejaPris, validerPseudo } from "@/lib/identite";
import { decisionParrainage, normaliserCode } from "@/lib/parrainage";


// Code lisible : pas de caractères ambigus (0/O, 1/l/I).
function generateCode(length = 8): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(length);
  return Array.from(bytes).map((b) => chars[b % chars.length]).join("");
}

function toIntOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (await isRateLimited(ip, "register")) {
      return NextResponse.json({ error: "Trop de tentatives. Réessaie plus tard." }, { status: 429 });
    }
    await recordAttempt(ip, "register");

    const body = await request.json();
    // Pseudo : seul champ obligatoire. Les règles vivent dans `identite`, avec
    // celles des deux autres chemins d'écriture — c'est leur divergence qui a
    // ouvert l'escalade d'administrateur.
    const verdict = validerPseudo(body.pseudo);
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.erreur }, { status: verdict.statut });
    }
    const pseudo = verdict.valeur;

    // Email optionnel (pour la récupération de compte). Si fourni : valider + unicité.
    let email: string | null = null;
    if (body.email) {
      email = normaliserEmail(body.email);
      if (!email) {
        return NextResponse.json({ error: "Email invalide" }, { status: 400 });
      }
      const emailTaken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (emailTaken) {
        return NextResponse.json({ error: "Un compte existe déjà avec cet email" }, { status: 409 });
      }
    }

    // Le comptage reste : il donne son rang d'arrivée au compte. Ce n'est plus
    // une porte. Le plafond de cent existait pour tenir le rythme des premiers
    // jours ; il a surtout tenu le produit fermé pendant que personne n'entrait.
    const count = await prisma.user.count();

    // Unicité côté appli (pas de contrainte DB : des pseudos existants sont dupliqués).
    if (await pseudoDejaPris(pseudo)) {
      return NextResponse.json({ error: "Ce pseudo est déjà pris. Choisis-en un autre." }, { status: 409 });
    }

    const code = generateCode();
    const passwordHash = await bcrypt.hash(code, 12);

    /**
     * Le parrain, s'il y en a un.
     *
     * Lu AVANT la création du compte, pour que le lien se pose dans la même
     * écriture : posé après, une panne entre les deux laisserait un filleul
     * sans parrain, et le lien ne se rattrape pas — il ne se pose qu'à la
     * création.
     *
     * Rien ici ne peut faire échouer l'inscription. Un code tronqué par un
     * client de messagerie, recopié de travers, ou dont le parrain a supprimé
     * son compte, laisse simplement passer : refuser reviendrait à perdre
     * celui qu'on venait de convaincre en lui disant que c'est sa faute.
     */
    const codeParrain = normaliserCode(body.parrain);
    const parrain = codeParrain
      ? await prisma.user.findUnique({
          where: { codeParrain },
          select: { id: true },
        })
      : null;
    const lien = decisionParrainage(body.parrain, parrain);

    const user = await prisma.user.create({
      data: {
        pseudo,
        email,
        passwordHash,
        betaRank: count + 1,
        genre: body.genre ? String(body.genre) : null,
        age: toIntOrNull(body.age),
        poids: toIntOrNull(body.poids),
        taille: toIntOrNull(body.taille),
        sportsHoursPerWeek: toIntOrNull(body.sportsHoursPerWeek),
        parrainId: lien.quoi === "lie" ? lien.parrainId : null,
      },
    });

    /**
     * L'avantage : les deux comptes deviennent amis, tout de suite.
     *
     * Le filleul arrive avec quelqu'un dans son classement plutôt qu'avec la
     * phrase « tu es seul ici », et le parrain gagne la personne qu'il a fait
     * venir. Aucun point d'effort n'est offert : ce serait une pompe que
     * personne n'a faite, et le classement, les paliers et le bilan
     * deviendraient faux d'un coup.
     *
     * L'échec ne coûte que lui-même. Le compte existe, le lien de parrainage
     * est posé — une amitié qui ne s'écrit pas se redemande à la main, ce qui
     * est désagréable et rattrapable.
     */
    if (lien.quoi === "lie") {
      await prisma.amitie
        .create({
          data: {
            demandeurId: lien.parrainId,
            receveurId: user.id,
            etat: "acceptee",
            accepteeLe: new Date(),
          },
        })
        .catch(() => {});
    }

    // Cette route EST la porte d'entrée officielle : ce qui en sort a le droit
    // d'entrer. La porte de connexion le déduisait de l'absence d'adresse, ce
    // qui devenait faux dès que le champ e-mail — facultatif — était rempli :
    // la personne repartait avec un code et un compte qu'elle ne pouvait
    // jamais ouvrir. On l'inscrit donc explicitement.
    await autoriserAdresse(email);

    // Même raison qu'à l'inscription : sans objectif par défaut, la barre de
    // progression ne s'affiche pas, et c'est tout. Le compte, lui, existe.
    await prisma.goal
      .create({ data: { userId: user.id, objectifTotalPompes: 1000 } })
      .catch(() => {});

    return NextResponse.json({ code });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
