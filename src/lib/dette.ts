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
