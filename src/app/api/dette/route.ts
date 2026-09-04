import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retirerDeLaDette } from "@/lib/dette";
import { meriteEclair } from "@/lib/exploits";
import { getCurrentUser } from "@/lib/auth-helpers";
import {
  dureeEffort, exercicesEnTemps, secondesParPoint, toExerciceIds,
} from "@/lib/exercices";
import { chargerRatios } from "@/lib/exercicesConfig";
import { reponseDette } from "@/lib/contexteConnecte";
import { estJourValide, jourLocal } from "@/lib/serie";
import { partPayeeQuantite } from "@/lib/conversionDette";
import { toExerciceId } from "@/lib/exercices";
import { DUREE_MAX_SEC, QUANTITE_MAX, entierBorne } from "@/lib/bornesSaisie";


export async function GET() {
  // La dette s'exprime en temps d'effort : sans les ratios réglés en
  // administration, la durée renvoyée serait celle des valeurs d'origine.
  await chargerRatios();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json(reponseDette(user));
}

/**
 * Acquitte tout ou partie de la dette.
 *  - `{ tout: true }`                        → remise à zéro (tout est fait)
 *  - `{ secondes: 120 }`                     → paiement partiel au temps
 *  - `{ quantite: 40, exercice: "pompes" }`  → paiement partiel au compteur
 *
 * La troisième forme vient du « convertir en » : on doit dix minutes de boxe,
 * on n'a pas la place de boxer, on fait des pompes à la place. Et comme dix
 * minutes de boxe font beaucoup de pompes, on n'en fait pas forcément le
 * compte d'un coup — d'où un paiement partiel, comme pour le chrono.
 *
 * **La conversion se fait ICI, jamais au navigateur.** Les ratios font
 * autorité au serveur, et c'est un défaut déjà payé : la pastille convertissait
 * les points chez le client pendant que le décompte lisait la durée calculée au
 * serveur, et les deux annonçaient deux nombres différents pour la même dette.
 */
export async function PATCH(req: Request) {
  // La dette s'exprime en temps d'effort : sans les ratios réglés en
  // administration, la durée renvoyée serait celle des valeurs d'origine.
  await chargerRatios();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const exercices = exercicesEnTemps(toExerciceIds(user.exercices));
  const dus = Math.max(0, user.dettePointsDus);

  let restant = 0;
  if (!body?.tout && body?.quantite !== undefined) {
    /**
     * Paiement au COMPTEUR, dans l'unité d'un exercice choisi.
     *
     * L'exercice doit être nommé : sans lui, « 40 » ne veut rien dire — c'est
     * quarante pompes, quarante secondes ou quarante kilomètres selon ce qu'on
     * a en tête, et se tromper d'unité efface une dette qu'on n'a pas payée.
     * `toExerciceId` referme la liste ; une valeur inconnue est refusée plutôt
     * que ramenée à un défaut, parce que le défaut paierait au mauvais tarif.
     */
    const exercice = typeof body?.exercice === "string" ? body.exercice : "";
    if (!exercice || toExerciceId(exercice) !== exercice) {
      return NextResponse.json({ error: "Exercice inconnu" }, { status: 400 });
    }
    /**
     * La quantité peut être décimale — la course se compte par pas de cent
     * mètres — donc `entierBorne` ne convient pas. Ce qui est refusé reste le
     * même : ce qui n'est pas un nombre fini, ce qui est négatif, et ce qui
     * dépasse une borne au-delà de laquelle personne n'a rien fait.
     */
    /**
     * Le type se vérifie AVANT la conversion, et c'est le piège du projet :
     * `Number(null)` vaut zéro, `Number([])` aussi. Or `JSON.stringify(NaN)`
     * rend `null` — donc une quantité que le navigateur n'a pas su écrire
     * arrivait ici comme un abandon immédiat, et la route répondait 200 en
     * ne payant rien. Absent et aberrant sont deux choses différentes ; seul
     * un nombre écrit comme un nombre entre.
     */
    const faite = typeof body.quantite === "number" ? body.quantite : Number.NaN;
    if (!Number.isFinite(faite) || faite < 0 || faite > QUANTITE_MAX) {
      return NextResponse.json({ error: "Quantité invalide" }, { status: 400 });
    }
    const part = partPayeeQuantite(faite, dus, toExerciceId(exercice), await chargerRatios());
    restant = Math.max(0, dus - Math.round(dus * part));
  } else if (!body?.tout) {
    /**
     * Une durée impossible ne vaut pas « tout est fait ».
     *
     * `Number(x) || 0` acceptait `1e308`, la proportion payée était plafonnée
     * à un, et la dette entière disparaissait — 47 points effacés par une
     * valeur que personne ne peut avoir faite. Le plafonnement reste pour le
     * cas légitime (dix minutes faites sur cinq minutes dues) ; ce qui est
     * refusé, c'est ce qui n'est pas une durée.
     */
    const secondesFaites = entierBorne(body?.secondes, DUREE_MAX_SEC);
    if (secondesFaites === null) {
      return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
    }
    const totalSec = dureeEffort(dus, exercices);
    // Un arrêt en cours de route ne paie que le temps réellement effectué.
    const partPayee = totalSec > 0 ? Math.min(1, secondesFaites / totalSec) : 1;
    restant = Math.max(0, dus - Math.round(dus * partPayee));
  }

  const paye = Math.max(0, dus - restant);

  /**
   * Le paiement laisse une trace, et la date de début de dette se met à jour.
   *
   * Le compteur ne dit que l'état présent : sans historique, une série de
   * jours consécutifs ne se calcule pas, et « en retard depuis trois jours »
   * non plus. Ces deux-là ne sont pas rattrapables après coup.
   *
   * Le jour vient du navigateur : le jour UTC ferait basculer la série d'un
   * jour sur l'autre selon le fuseau de la personne. À défaut, celui du
   * serveur.
   */
  /**
   * `estJourValide` et non le motif seul : la FORME d'une date ne dit pas
   * qu'elle existe. « 2026-02-30 » et « 9999-99-99 » passent le motif, et ce
   * jour-ci est écrit tel quel dans `Paiement.jour` — il resterait en base
   * pour toujours, sur un jour qu'aucun calendrier ne contient. La série se
   * compte en remontant jour par jour : un paiement posé là ne compterait
   * jamais, et l'effort serait fait pour rien.
   *
   * Le repli existait déjà pour ce cas exact ; le motif le court-circuitait.
   */
  const jour = estJourValide(body?.jour) ? (body.jour as string) : jourLocal();

  /**
   * Jeton d'un paiement rejoué depuis la file hors ligne.
   *
   * Un téléphone qui retrouve le réseau réessaie tant qu'il n'a pas reçu de
   * réponse — et une réponse perdue en chemin est indiscernable d'une requête
   * jamais arrivée. Sans jeton, ce cas-là paie deux fois la même séance, et
   * c'est le cas normal dans un tunnel.
   *
   * Le contrôle se fait avant la transaction pour la réponse courante, et
   * l'unicité en base la garantit pour de bon : deux renvois partis en même
   * temps passeraient tous deux ce test.
   */
  const jeton = typeof body?.jeton === "string" && body.jeton.length > 0
    ? body.jeton.slice(0, 64)
    : null;
  if (jeton) {
    const deja = await prisma.paiement.findUnique({
      where: { jeton },
      select: { userId: true },
    });
    // Le jeton d'un autre compte n'est pas une raison de refuser : il ne dit
    // rien de celui-ci. C'est le sien, et lui seul, qui vaut « déjà payé ».
    if (deja?.userId === user.id) return NextResponse.json(reponseDette(user));
  }

  /**
   * Deux écritures, sans transaction, et dans cet ordre-là.
   *
   * **Le pilote HTTP de Neon refuse les transactions**, et c'est celui de la
   * production : `PrismaNeonHttp.startTransaction()` rejette avec
   * « Transactions are not supported in HTTP mode ». La base locale, elle,
   * passe par `PrismaPg` en TCP, où tout fonctionne — donc les 1689 tests
   * unitaires et les 188 parcours navigateur passaient tous pendant qu'AUCUN
   * paiement n'aboutissait en ligne. La file hors ligne se remplissait, et son
   * seul symptôme était « des séances faites hors réseau » sur une machine
   * parfaitement connectée.
   *
   * L'ordre n'est pas indifférent, parce qu'il n'y a plus rien pour rattraper
   * une écriture qui passe et l'autre pas :
   *
   * - la TRACE d'abord. Si le décompte échoue derrière, l'effort est
   *   enregistré et la dette reste due : la personne la refait, ce qui est
   *   désagréable et rattrapable.
   * - l'inverse — décompter puis échouer à tracer — laisserait une dette
   *   effacée sans trace, et le renvoi la décompterait une seconde fois. Une
   *   dette qu'on ne doit plus sans savoir pourquoi ne se rattrape pas.
   *
   * Le jeton rend le renvoi sûr : `P2002` dit que cette séance-ci est déjà
   * enregistrée, donc qu'il ne faut surtout pas décompter à nouveau.
   */
  if (paye > 0) {
    try {
      await prisma.paiement.create({ data: { userId: user.id, points: paye, jour, jeton } });
    } catch (e) {
      if (jeton && (e as { code?: string })?.code === "P2002") {
        // Déjà enregistrée : la dette a déjà été décomptée pour cette
        // séance-là, ou le sera par le renvoi qui a gagné la course. On rend
        // la dette FRAÎCHE — celle portée par `user` date du début de la
        // requête, donc d'avant le paiement jumeau.
        const frais = await prisma.user.findUniqueOrThrow({
          where: { id: user.id },
          select: { dettePointsDus: true, rappelSeuilSec: true, exercices: true },
        });
        return NextResponse.json(reponseDette(frais));
      }
      throw e;
    }
  }

  // Le retrait reste atomique en lui-même : `decrement` côté base, pour qu'une
  // partie enregistrée pendant le paiement ne se fasse pas écraser.
  await retirerDeLaDette(prisma, user.id, paye);

  /**
   * L'exploit se pose APRÈS le décompte, et son échec ne coûte que lui-même.
   *
   * L'ordre suit celui déjà choisi ici pour la trace et le décompte : ce qui
   * peut se refaire à la main passe en dernier. Un badge manqué se rattrape au
   * prochain soir ; une dette décomptée sans trace ne se rattrape pas.
   *
   * `updateMany` avec la condition dans le `where` plutôt qu'un `update` après
   * lecture : deux paiements partis en même temps liraient tous deux « pas
   * encore d'exploit », et le second écraserait la date du premier. La
   * condition est donc posée à la BASE, comme pour la date de début de dette.
   */
  if (meriteEclair({ depuis: user.detteDepuis, paye, restant, deja: user.paiementEclairLe })) {
    // `try` et non `.catch()` : celui-ci ne rattrape qu'une promesse rejetée,
    // pas un jet synchrone — et un badge manqué ne doit sous aucun prétexte
    // faire échouer un paiement qui, lui, a bien eu lieu.
    try {
      await prisma.user.updateMany({
        where: { id: user.id, paiementEclairLe: null },
        data: { paiementEclairLe: new Date() },
      });
    } catch { /* Un exploit manqué se rattrape au prochain soir. */ }
  }
  const maj = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { dettePointsDus: true, rappelSeuilSec: true, exercices: true },
  });
  return NextResponse.json(reponseDette(maj));
}

/**
 * Fixe directement la valeur du compteur, en secondes d'effort. Sert à tester
 * le rappel sans devoir enregistrer des parties jusqu'à franchir le seuil.
 */
export async function PUT(req: Request) {
  // La dette s'exprime en temps d'effort : sans les ratios réglés en
  // administration, la durée renvoyée serait celle des valeurs d'origine.
  await chargerRatios();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const secondes = Number(body?.secondes);
  // Jusqu'à 2 h : au-delà on ne teste plus rien, on casse juste ses données.
  if (!Number.isFinite(secondes) || secondes < 0 || secondes > 7200) {
    return NextResponse.json({ error: "Durée invalide" }, { status: 400 });
  }

  const exercices = exercicesEnTemps(toExerciceIds(user.exercices));
  if (exercices.length === 0) {
    return NextResponse.json({ error: "Aucun exercice au temps sélectionné" }, { status: 400 });
  }

  // Le compteur vit en points d'effort : on convertit la durée demandée avec
  // la même cadence que celle qui sert à l'afficher.
  const parPoint = secondesParPoint(exercices[0]);
  const points = parPoint > 0 ? Math.round(secondes / parPoint) : 0;

  const maj = await prisma.user.update({
    where: { id: user.id },
    data: { dettePointsDus: points },
    select: { dettePointsDus: true, rappelSeuilSec: true, exercices: true },
  });
  return NextResponse.json(reponseDette(maj));
}
