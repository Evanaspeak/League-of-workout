import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chargerBareme, oublierBareme } from "@/lib/baremeConfig";
import { getCurrentUser } from "@/lib/auth-helpers";
import { comptePublic } from "@/lib/compte";
import { isExerciceId, toExerciceIds } from "@/lib/exercices";
import { estAdmin } from "@/lib/admin";
import { toVariante } from "@/lib/variantes";
import { estLocale } from "@/lib/i18n/langues";
import { estFuseauValide } from "@/lib/fuseau";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Le barème est global et mis en cache ; l'objectif appartient au compte et
  // se relit à chaque fois.
  const [{ roleWeights, levelConfigs, masteryConfig }, goal] = await Promise.all([
    chargerBareme(),
    prisma.goal.findUnique({ where: { userId: user.id } }),
  ]);
  return NextResponse.json({
    roleWeights, levelConfigs, masteryConfig, goal, user: comptePublic(user),
  });
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
      variantePompes?: string | null;
      langue?: string;
      fuseau?: string;
      bilanActif?: boolean;
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

    // Langue du compte. Elle ne sert à rien dans le navigateur, qui a déjà la
    // sienne en stockage local : elle sert au serveur, qui écrit les
    // notifications et n'a aucun autre moyen de savoir à qui il parle.
    if (body.userPrefs.langue !== undefined) {
      if (!estLocale(body.userPrefs.langue)) {
        return NextResponse.json({ error: "Langue inconnue" }, { status: 400 });
      }
      data.langue = body.userPrefs.langue;
    }

    // Recevoir ou non le bilan hebdomadaire. Un envoi récurrent doit pouvoir
    // s'éteindre : celui qui ne peut pas l'éteindre se désabonne de tout.
    if (body.userPrefs.bilanActif !== undefined) {
      if (typeof body.userPrefs.bilanActif !== "boolean") {
        return NextResponse.json({ error: "Valeur invalide" }, { status: 400 });
      }
      data.bilanActif = body.userPrefs.bilanActif;
    }

    // Fuseau horaire, pour savoir quelle heure il est chez la personne. Le
    // serveur ne connaît que l'UTC, et « le matin » en UTC est le milieu de
    // la nuit pour une partie du monde.
    if (body.userPrefs.fuseau !== undefined) {
      if (!estFuseauValide(body.userPrefs.fuseau)) {
        return NextResponse.json({ error: "Fuseau inconnu" }, { status: 400 });
      }
      data.fuseau = body.userPrefs.fuseau;
    }

    // Variante d'exécution des pompes. Elle ne touche à aucun calcul : elle
    // est recopiée sur les parties enregistrées ensuite, pour qu'on puisse se
    // relire. `null` la retire — c'est le geste qu'on fait le jour où on n'en
    // a plus besoin, et il ne doit rien réécrire de l'historique passé.
    if (body.userPrefs.variantePompes !== undefined) {
      const v = body.userPrefs.variantePompes;
      if (v !== null && toVariante(v) === null) {
        return NextResponse.json({ error: "Variante inconnue" }, { status: 400 });
      }
      data.variantePompes = v === null ? null : toVariante(v);
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

    /**
     * Les mesures physiques, enfin modifiables — et seulement avec le
     * consentement.
     *
     * Elles étaient saisies à l'inscription puis figées à vie : quelqu'un qui
     * perd huit kilos gardait son ancien poids, et le droit de rectification
     * n'avait aucun chemin. Elles relèvent de l'article 9 du RGPD, donc la
     * route les refuse tant que le consentement explicite n'est pas donné.
     * L'interface le demande avant d'ouvrir le formulaire ; l'interface n'est
     * pas une frontière, cette vérification l'est.
     */
    const SANTE = {
      genre: (v: unknown) => {
        const g = String(v);
        // « Non précisé » est une valeur, pas une absence : le calcul prend
        // alors la moyenne des deux autres.
        if (!["homme", "femme", "non-precise"].includes(g)) throw new RangeError("Genre inconnu");
        return g;
      },
      age: (v: unknown) => Math.round(borne(v, 13, 99)),
      poids: (v: unknown) => Math.round(borne(v, 30, 300)),
      taille: (v: unknown) => Math.round(borne(v, 100, 250)),
      sportsHoursPerWeek: (v: unknown) => Math.round(borne(v, 0, 40)),
    } as const;

    const santeDemandee = Object.keys(SANTE)
      .filter((c) => body.userPrefs[c] !== undefined);

    if (santeDemandee.length > 0) {
      if (!user.santeConsentiLe) {
        return NextResponse.json(
          { error: "Consentement aux données de santé requis" },
          { status: 403 },
        );
      }
      try {
        for (const champ of santeDemandee) {
          const valeur = body.userPrefs[champ];
          // Vider un champ est un droit : une chaîne vide ou `null` l'efface,
          // sans qu'il faille retirer le consentement pour tout le reste.
          (data as Record<string, unknown>)[champ] = valeur === null || valeur === ""
            ? null
            : SANTE[champ as keyof typeof SANTE](valeur);
        }
      } catch {
        return NextResponse.json({ error: "Mesure physique hors bornes" }, { status: 400 });
      }
    }

    if (Object.keys(data).length > 0) {
      updates.push(prisma.user.update({ where: { id: user.id }, data }));
    }
  }

  // Les trois branches ci-dessous écrivent une configuration commune à TOUS les
  // comptes : poids par rôle, seuils de niveau, surcharge de maîtrise. Elles
  // décident de ce que chaque utilisateur devra physiquement faire.
  //
  // Elles étaient ouvertes à n'importe quel compte connecté. Le bornage des
  // valeurs empêchait de rendre un score inécrivable, mais rien n'empêchait de
  // mettre le multiplicateur à zéro — plus personne ne doit rien — ou le malus
  // de défaite au maximum, pour tout le monde et sans que personne le voie. Le
  // panneau était réservé aux bêta-testeurs dans l'interface, ce qui ne
  // protégeait rien : l'interface n'est pas une frontière, la route l'est.
  //
  // La lecture reste ouverte, elle : chacun a le droit de savoir comment sa
  // dette est calculée.
  const configPartagee = body.roleWeights || body.levelConfigs || body.masteryConfig;
  if (configPartagee && !estAdmin(user.email)) {
    return NextResponse.json(
      { error: "Cette configuration est commune à tous les comptes" },
      { status: 403 },
    );
  }

  // Chaque valeur reste bornée côté serveur : un `Number()` nu laissait passer
  // de quoi rendre un score non représentable, et c'est toute l'application qui
  // cessait d'enregistrer des parties.
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
  /**
   * Le cache du barème se vide APRÈS l'écriture, pas avant.
   *
   * Sans ça, l'administrateur qui vient de changer un multiplicateur continue
   * de voir l'ancien pendant une minute — sur l'écran même où il vient de le
   * modifier. Les autres instances mettront au pire ce délai à suivre, ce qui
   * est le prix assumé du cache ; celle qui reçoit l'enregistrement, elle, n'a
   * aucune raison de le payer.
   */
  oublierBareme();
  return NextResponse.json({ ok: true });
}
