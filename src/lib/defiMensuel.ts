/**
 * Les défis du mois (ligne 131, réponse « en volume ET en nombre de parties »).
 *
 * **Deux à la fois, et pas un tiré au sort.** C'est ce que la réponse demande,
 * et c'est aussi ce qui les distingue du défi quotidien : celui-ci change tous
 * les jours et n'en montre qu'un, ceux-là durent un mois et se poursuivent
 * ensemble. Un mois est assez long pour qu'on ne se souvienne pas d'un défi
 * qu'on aurait vu une fois ; il faut donc qu'il soit toujours là.
 *
 * **Ce qu'on gagne à les finir n'est pas décidé.** La réponse 139 dit « à
 * voir », et la 137 demande « trois niveaux, récompenses exponentielles, et
 * des malus si échoué » — c'est-à-dire une échelle de récompenses qui n'existe
 * pas encore et une dette qu'on ajouterait sans qu'elle vienne d'une partie.
 * Les deux se décident avec le propriétaire du produit, pas ici. Ce qui est
 * construit est donc l'objectif seul : il se voit, il se poursuit, il se
 * termine. Les niveaux viendront se poser dessus.
 */

export type DefiMensuel = {
  cle: string;
  cible: number;
  mesure: "points" | "parties";
};

/**
 * Les deux cibles, et pourquoi celles-là.
 *
 * Deux mille points d'effort dans le mois, c'est l'ordre de grandeur de trois
 * soirées par semaine payées jusqu'au bout — atteignable en jouant comme on
 * joue, hors d'atteinte en ouvrant l'application deux fois. Quarante parties
 * suit le même raisonnement de l'autre côté.
 *
 * Elles sont les MÊMES pour tout le monde, comme le défi du jour. Les adapter
 * au rythme de chacun ferait un objectif qui s'éloigne à mesure qu'on
 * s'approche, ce qui est le contraire d'un objectif.
 */
export const DEFIS_MENSUELS: DefiMensuel[] = [
  { cle: "moisPoints", cible: 2000, mesure: "points" },
  { cle: "moisParties", cible: 40, mesure: "parties" },
];

/** Le mois d'un jour, sous la forme `AAAA-MM`. */
export function moisDuJour(jour: string): string | null {
  if (typeof jour !== "string") return null;
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(jour);
  if (!m) return null;
  const mois = Number(m[2]);
  // Le mois se contrôle pour lui-même : « 2026-13-01 » a la bonne forme et
  // n'existe pas, et un préfixe faux ne compterait jamais aucun paiement.
  if (mois < 1 || mois > 12) return null;
  return `${m[1]}-${m[2]}`;
}

/** Le premier instant du mois, en UTC, pour borner une requête de parties. */
export function debutDuMois(jour: string): Date | null {
  const mois = moisDuJour(jour);
  return mois ? new Date(`${mois}-01T00:00:00.000Z`) : null;
}

export type SourceMois = {
  pointsPayesDuMois: number;
  partiesDuMois: number;
};

export type AvancementMensuel = {
  cle: string;
  cible: number;
  ou: number;
  fait: boolean;
};

export function avancementMensuel(
  defi: DefiMensuel,
  source: SourceMois,
): AvancementMensuel {
  const brut = defi.mesure === "points" ? source.pointsPayesDuMois : source.partiesDuMois;
  const valeur = Number.isFinite(brut) ? Math.max(0, Math.floor(brut)) : 0;
  return {
    cle: defi.cle,
    cible: defi.cible,
    ou: Math.min(defi.cible, valeur),
    fait: valeur >= defi.cible,
  };
}

/** Les deux, dans l'ordre où ils sont déclarés. */
export function defisDuMois(source: SourceMois): AvancementMensuel[] {
  return DEFIS_MENSUELS.map((d) => avancementMensuel(d, source));
}
