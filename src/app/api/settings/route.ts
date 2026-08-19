import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { isExerciceId, toExerciceIds } from "@/lib/exercices";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const [roleWeights, levelConfigs, masteryConfig, goal] = await Promise.all([
    prisma.roleWeight.findMany({ orderBy: { role: "asc" } }),
    prisma.levelConfig.findMany({ orderBy: { niveau: "asc" } }),
    prisma.masteryConfig.findFirst(),
    prisma.goal.findUnique({ where: { userId: user.id } }),
  ]);
  // Le hash du mot de passe n'a rien à faire dans le navigateur.
  const { passwordHash: _ignore, ...userSansSecret } = user;
  void _ignore;
  return NextResponse.json({ roleWeights, levelConfigs, masteryConfig, goal, user: userSansSecret });
}

/**
 * Borne une valeur numérique venue du client.
 *
 * Le formulaire des réglages pose bien `min` et `max` sur ses champs — mais en
 * HTML, donc côté navigateur seulement. Une requête directe passait des nombres
 * arbitraires dans une configuration partagée par tout le monde : un
 * multiplicateur assez grand rendait un score que la colonne entière ne sait pas
 * écrire, et plus personne ne pouvait enregistrer de partie. Aucune route
 * d'administration ne savait réparer ça.
 */
function borne(valeur: unknown, min: number, max: number): number {
  const n = Number(valeur);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new RangeError("Valeur hors bornes");
  }
  return n;
}

export async function PUT(req: Request) {
  // La session se résout avant toute branche. Elle vivait à l'intérieur de
  // `userPrefs` : un corps qui ne contenait que la configuration partagée ne la
  // traversait jamais, et le seul contrôle restant était celui du middleware.
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json();

  const updates: Promise<unknown>[] = [];

  // Préférences propres à l'utilisateur, scopées à son propre compte. La
  // configuration de scoring, elle, reste volontairement partagée entre
  // bêta-testeurs — c'est un choix produit, pas un oubli.
  if (body.userPrefs) {

    const data: {
      exercices?: string[]; rappelSeuilPoints?: number;
      rappelSeuilSec?: number; plafondQuotidien?: number;
      pompesMax?: number; pompesMaxLe?: Date;
    } = {};

    if (body.userPrefs.exercices !== undefined) {
      const bruts = body.userPrefs.exercices;
      if (!Array.isArray(bruts) || bruts.length === 0 || !bruts.every(isExerciceId)) {
        return NextResponse.json({ error: "Exercice inconnu" }, { status: 400 });
      }
      data.exercices = toExerciceIds(bruts);
    }

    if (body.userPrefs.rappelSeuilPoints !== undefined) {
      const seuil = Number(body.userPrefs.rappelSeuilPoints);
      if (!Number.isFinite(seuil) || seuil < 0 || seuil > 1000) {
        return NextResponse.json({ error: "Seuil de rappel invalide" }, { status: 400 });
      }
      data.rappelSeuilPoints = Math.round(seuil);
    }

    // Seuil du compteur de dette en attente, en secondes d'effort. 0 désactive
    // le rappel ; au-delà d'une heure, il ne préviendrait plus jamais à temps.
    if (body.userPrefs.rappelSeuilSec !== undefined) {
      const seuilSec = Number(body.userPrefs.rappelSeuilSec);
      if (!Number.isFinite(seuilSec) || seuilSec < 0 || seuilSec > 3600) {
        return NextResponse.json({ error: "Seuil de rappel invalide" }, { status: 400 });
      }
      data.rappelSeuilSec = Math.round(seuilSec);
    }

    // Avertissement de volume quotidien, en points d'effort. 0 le désactive.
    // La borne haute évite un réglage qui ne préviendrait jamais.
    if (body.userPrefs.plafondQuotidien !== undefined) {
      const plafond = Number(body.userPrefs.plafondQuotidien);
      if (!Number.isFinite(plafond) || plafond < 0 || plafond > 5000) {
        return NextResponse.json({ error: "Plafond quotidien invalide" }, { status: 400 });
      }
      data.plafondQuotidien = Math.round(plafond);
    }

    // Test de pompes maximales : c'est lui qui fixe le niveau, donc le
    // multiplicateur. La date est posée par le serveur — une date fournie par
    // le client permettrait de faire passer un test périmé pour récent.
    if (body.userPrefs.pompesMax !== undefined) {
      const max = Number(body.userPrefs.pompesMax);
      if (!Number.isFinite(max) || max < 0 || max > 500) {
        return NextResponse.json({ error: "Test de pompes invalide" }, { status: 400 });
      }
      data.pompesMax = Math.round(max);
      data.pompesMaxLe = new Date();
    }

    if (Object.keys(data).length > 0) {
      updates.push(prisma.user.update({ where: { id: user.id }, data }));
    }
  }

  // Les trois branches ci-dessous écrivent une configuration commune à tous les
  // comptes. Chaque valeur est bornée côté serveur : un `Number()` nu laissait
  // passer de quoi rendre un score non représentable, et c'est toute
  // l'application qui cessait d'enregistrer des parties.
  try {
    if (body.roleWeights) {
      for (const rw of body.roleWeights) {
        updates.push(
          prisma.roleWeight.update({
            where: { role: String(rw.role) },
            data: {
              poidsMort: borne(rw.poidsMort, 0, 100),
              poidsKill: borne(rw.poidsKill, 0, 100),
              poidsAssist: borne(rw.poidsAssist, 0, 100),
              maitriseActive: Boolean(rw.maitriseActive),
            },
          })
        );
      }
    }

    if (body.levelConfigs) {
      for (const lc of body.levelConfigs) {
        updates.push(
          prisma.levelConfig.update({
            where: { niveau: borne(lc.niveau, 1, 99) },
            data: {
              seuilGainageSec: borne(lc.seuilGainageSec, 0, 3600),
              // Critère actuel du niveau : le nombre de pompes d'affilée.
              ...(lc.seuilPompes != null ? { seuilPompes: borne(lc.seuilPompes, 0, 500) } : {}),
              multiplicateur: borne(lc.multiplicateur, 0, 10),
              malusDefaite: borne(lc.malusDefaite, 0, 100),
            },
          })
        );
      }
    }

    if (body.masteryConfig) {
      updates.push(
        prisma.masteryConfig.update({
          where: { id: 1 },
          data: {
            surchargeMax: borne(body.masteryConfig.surchargeMax, 0, 5),
            // Diviseur : à zéro il rendait NaN, donc un score inécrivable.
            partiesPourMax: borne(body.masteryConfig.partiesPourMax, 1, 10000),
          },
        })
      );
    }
  } catch (err) {
    if (err instanceof RangeError) {
      return NextResponse.json({ error: "Valeur hors bornes" }, { status: 400 });
    }
    throw err;
  }

  await Promise.all(updates);
  return NextResponse.json({ ok: true });
}
