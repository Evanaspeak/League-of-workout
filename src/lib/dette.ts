import type { prisma } from "@/lib/prisma";

/**
 * Le client accepté : le client global, ou celui d'une transaction. Les deux
 * portent le même délégué `user`, et c'est tout ce qu'on emploie ici.
 */
type ClientDette = { user: (typeof prisma)["user"] };

/**
 * Retirer des points de la dette, sans jamais perdre ce qui arrive en même
 * temps.
 *
 * La dette était réécrite en valeur ABSOLUE : on lisait, on calculait ce qui
 * reste, on écrivait. Entre la lecture et l'écriture, une partie enregistrée
 * par l'application de bureau voyait sa dette effacée. Ce n'est pas un cas
 * tordu : on finit sa série au moment où la partie se termine, et le paiement
 * est plus rapide que l'écriture de la partie une fois sur deux.
 *
 * `decrement` est atomique côté base : deux écritures concurrentes s'ajoutent
 * au lieu de s'écraser. Il n'a pas de plancher, d'où la remise à zéro juste
 * après si on est passé sous la ligne — le cas légitime étant « j'ai fait plus
 * que ce que je devais ».
 *
 * La fenêtre où la valeur est négative existe, et elle est bornée à une
 * requête. Tout ce qui lit la dette la borne déjà à zéro (`Math.max(0, …)`),
 * précisément parce qu'une valeur négative n'a aucun sens à l'écran.
 */
export async function retirerDeLaDette(
  db: ClientDette,
  userId: string,
  points: number,
): Promise<number> {
  if (points <= 0) {
    const inchange = await db.user.findUnique({
      where: { id: userId },
      select: { dettePointsDus: true },
    });
    return Math.max(0, inchange?.dettePointsDus ?? 0);
  }

  const maj = await db.user.update({
    where: { id: userId },
    data: { dettePointsDus: { decrement: points } },
    select: { dettePointsDus: true },
  });
  if (maj.dettePointsDus > 0) return maj.dettePointsDus;

  // Sous zéro, ou pile dessus : la dette est éteinte, et sa date de début n'a
  // plus de sens. Les deux se posent ensemble, sinon un compteur de retard
  // continue de courir sur une dette soldée.
  await db.user.update({
    where: { id: userId },
    data: { dettePointsDus: 0, detteDepuis: null },
  });
  return 0;
}

/**
 * Ajouter des points à la dette, en posant sa date de début si elle naît.
 *
 * Ces deux écritures allaient ensemble dans `/api/games` ; elles doivent
 * maintenant servir aussi à la correction du résultat d'une partie, qui
 * réévalue son coût. Une règle écrite deux fois finit par ne valoir que pour
 * l'une des deux — c'est déjà arrivé quatre fois sur ce projet, et la dernière
 * fois c'est précisément cette date de début qui manquait d'un côté.
 *
 * L'incrément est atomique pour la même raison que le retrait : un paiement
 * qui s'intercale entre la lecture et l'écriture se perdrait.
 *
 * La date, elle, est posée par un `updateMany` CONDITIONNEL, pas d'après une
 * lecture faite juste avant : entre les deux, un paiement peut éteindre la
 * dette et effacer la date. On écrivait alors une dette positive sans date de
 * début, c'est-à-dire une dette qui n'est jamais en retard.
 *
 * Son échec ne coûte qu'elle-même : le décompte est déjà écrit, et le tour
 * suivant repassera dessus.
 */
export async function ajouterALaDette(
  db: ClientDette,
  userId: string,
  points: number,
): Promise<number> {
  if (points <= 0) {
    const inchange = await db.user.findUnique({
      where: { id: userId },
      select: { dettePointsDus: true },
    });
    return Math.max(0, inchange?.dettePointsDus ?? 0);
  }

  const maj = await db.user.update({
    where: { id: userId },
    data: { dettePointsDus: { increment: points } },
    select: { dettePointsDus: true },
  });

  try {
    await db.user.updateMany({
      where: { id: userId, detteDepuis: null, dettePointsDus: { gt: 0 } },
      data: { detteDepuis: new Date() },
    });
  } catch { /* la date se rattrapera au tour suivant */ }

  return Math.max(0, maj.dettePointsDus);
}
