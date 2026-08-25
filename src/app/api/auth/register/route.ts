import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordAttempt, getClientIp } from "@/lib/rate-limit";
import { MESSAGES_PORTE, porteMotDePasse } from "@/lib/porteBeta";
import { normaliserEmail, pseudoDejaPris, validerPseudo } from "@/lib/identite";

const BETA_LIMIT = 100;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (await isRateLimited(ip, "register")) {
      return NextResponse.json({ error: "Trop de tentatives. Réessaie plus tard." }, { status: 429 });
    }
    await recordAttempt(ip, "register");

    const body = await request.json();
    const password = body.password;

    // L'adresse est ramenée à sa forme canonique AVANT le contrôle d'unicité
    // comme avant l'écriture. Sans ça, l'index unique (octet par octet) laisse
    // passer une variante de casse que le test d'administrateur (insensible à
    // la casse) accepte ensuite : c'était le chemin d'escalade.
    const email = normaliserEmail(body.email);
    if (!email) {
      return NextResponse.json({ error: "Email invalide" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Mot de passe trop court (min 8 caractères)" }, { status: 400 });
    }
    const verdict = validerPseudo(body.pseudo);
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.erreur }, { status: verdict.statut });
    }
    const pseudo = verdict.valeur;

    // La porte de connexion n'ouvre le mot de passe qu'aux invités. Elle le
    // faisait seule, après coup : on créait donc un compte parfaitement
    // valide dont la première connexion était refusée, en accusant le mot de
    // passe. On pose la question avant d'écrire, et on dit la vraie raison.
    const porte = await porteMotDePasse(email);
    if (!porte.ouverte) {
      return NextResponse.json({ error: MESSAGES_PORTE[porte.raison] }, { status: 403 });
    }

    const count = await prisma.user.count();
    if (count >= BETA_LIMIT) {
      return NextResponse.json({ error: "Beta complète : les 100 places sont prises." }, { status: 403 });
    }

    // Une existence se répond par oui ou non : inutile de charger la ligne
    // entière, empreinte du mot de passe comprise, pour la jeter aussitôt.
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return NextResponse.json({ error: "Un compte existe déjà avec cet email" }, { status: 409 });
    }
    if (await pseudoDejaPris(pseudo)) {
      return NextResponse.json({ error: "Ce pseudo est déjà pris. Choisis-en un autre." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        pseudo,
        passwordHash,
        betaRank: count + 1,
      },
    });

    // L'objectif par défaut n'est pas une condition d'existence du compte :
    // sans lui, la barre de progression ne s'affiche pas, et c'est tout. Faire
    // échouer l'inscription pour ça reviendrait à refuser un compte parce
    // qu'une décoration manque.
    await prisma.goal
      .create({ data: { userId: user.id, objectifTotalPompes: 1000 } })
      .catch(() => {});

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
