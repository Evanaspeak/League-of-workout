/**
 * Garder l'écran allumé pendant une séance.
 *
 * Un téléphone s'éteint au bout de trente secondes. Une planche de cinq
 * minutes se fait donc devant un écran noir qu'il faut déverrouiller les mains
 * moites — et personne ne le signalera jamais, parce que ça ressemble à un
 * téléphone qui fait ce qu'un téléphone fait.
 *
 * Ce module ne DÉCIDE rien : il pose et retire. Quand poser est une décision,
 * et elle vit dans `seance.ts` avec les autres.
 */

/** Ce que le navigateur nous rend, réduit à ce dont on se sert. */
type Sentinelle = { release: () => Promise<void>; released?: boolean };
type AvecVerrou = {
  wakeLock?: { request: (type: "screen") => Promise<Sentinelle> };
};

/**
 * Le verrou est-il seulement possible ?
 *
 * Safari sur iPhone l'implémente depuis la 16.4, Firefox depuis peu, et un
 * navigateur de bureau ancien ne l'a pas du tout. Il n'y a AUCUN repli : on ne
 * peut pas empêcher un écran de s'éteindre autrement, et les astuces qui
 * traînent — une vidéo muette en boucle — coûtent de la batterie et de la
 * mémoire pour un résultat qui dépend du navigateur du jour.
 *
 * Ce qu'on peut faire, c'est ne rien promettre : la séance marche exactement
 * pareil sans, l'écran s'éteint, et rien n'est perdu — le chrono continue de
 * tourner, c'est du temps réel et non des tics d'animation.
 */
export function veillePossible(n: Navigator | undefined = typeof navigator === "undefined" ? undefined : navigator): boolean {
  return Boolean((n as unknown as AvecVerrou | undefined)?.wakeLock?.request);
}

/**
 * Demande le verrou. Rend de quoi le relâcher, ou `null`.
 *
 * Le refus n'est pas une panne : le navigateur refuse quand l'onglet passe en
 * arrière-plan, quand la batterie est basse, ou parce qu'il ne veut pas. On ne
 * le dit à personne — c'est un confort, pas une fonctionnalité — et la séance
 * ne change pas d'un pixel.
 */
export async function poserVeille(
  n: Navigator | undefined = typeof navigator === "undefined" ? undefined : navigator,
): Promise<Sentinelle | null> {
  const api = (n as unknown as AvecVerrou | undefined)?.wakeLock;
  if (!api?.request) return null;
  try {
    return await api.request("screen");
  } catch {
    return null;
  }
}

/**
 * Relâche le verrou, sans jamais lever.
 *
 * Il est relâché par le navigateur lui-même quand l'onglet passe en
 * arrière-plan : `release()` sur une sentinelle déjà relâchée rejette sur
 * certains navigateurs, et une séance ne peut pas tomber parce qu'on a rangé
 * son téléphone.
 */
export async function retirerVeille(s: Sentinelle | null): Promise<void> {
  if (!s) return;
  try { await s.release(); } catch { /* déjà relâchée : rien à faire */ }
}
