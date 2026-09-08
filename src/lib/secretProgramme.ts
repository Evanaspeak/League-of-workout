/**
 * Le verrou des déclencheurs programmés.
 *
 * Deux routes sont appelées par GitHub Actions et par personne d'autre — le
 * rappel du matin et le bilan hebdomadaire. Elles n'ont pas de session à lire :
 * ce qui les garde est un secret partagé, posé côté dépôt et côté Vercel.
 *
 * **Il était écrit DEUX fois, à l'identique.** C'est le pire endroit pour une
 * duplication : le jour où l'on resserre l'un des deux — une comparaison à
 * temps constant, un contrôle de longueur — l'autre garde la version lâche, et
 * c'est celle-là que personne ne relit. Le journal porte déjà ce motif sur les
 * deux listes de chemins publics, qui avaient laissé quatre routes partir en
 * 307 pendant des semaines.
 *
 * **Sans secret configuré, la route ne fait rien plutôt que de s'ouvrir** : une
 * variable oubliée ne doit pas transformer un déclencheur en porte ouverte.
 * C'est le défaut le plus sûr, et il est le même des deux côtés depuis qu'il
 * n'est écrit qu'une fois.
 *
 * **Deux en-têtes, une seule valeur.** GitHub Actions envoie ce qu'on lui dit
 * d'envoyer, donc `x-rappel-secret` ; les tâches planifiées de Vercel, non —
 * elles posent `Authorization: Bearer $CRON_SECRET` et cet en-tête-là ne se
 * choisit pas. Les deux sont acceptés, comparés à la MÊME variable : deux
 * secrets à tenir d'accord finissent par ne plus l'être, et c'est celui qu'on
 * relit le moins qui garde la version périmée. Côté Vercel, `CRON_SECRET` doit
 * donc valoir `RAPPEL_SECRET`.
 */
export function secretProgrammeValide(req: Request): boolean {
  const attendu = process.env.RAPPEL_SECRET;
  if (!attendu) return false;
  if (req.headers.get("x-rappel-secret") === attendu) return true;
  return req.headers.get("authorization") === `Bearer ${attendu}`;
}
