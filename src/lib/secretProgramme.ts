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
 */
export function secretProgrammeValide(req: Request): boolean {
  const attendu = process.env.RAPPEL_SECRET;
  if (!attendu) return false;
  return req.headers.get("x-rappel-secret") === attendu;
}
