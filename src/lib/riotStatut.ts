/**
 * Ce qu'on répond quand c'est Riot qui a refusé, pas nous.
 *
 * Les trois routes Riot renvoyaient le code de Riot tel quel :
 *
 *     return NextResponse.json({ … }, { status: idsRes.status });
 *
 * Deux conséquences, et la seconde est la pire.
 *
 * D'abord, **401 change de sens en chemin**. Dans toute l'application, 401 veut
 * dire « pas de session ». Ici il pouvait aussi vouloir dire « Riot a refusé
 * notre clé », ce qui n'a rien à voir : le journal de synchronisation
 * annonçait « clé refusée » à quelqu'un dont la session venait simplement
 * d'expirer, et l'écran pouvait le renvoyer à la connexion pour une clé
 * périmée côté serveur. Une clé de développement Riot expire toutes les
 * vingt-quatre heures : ce n'est pas un cas rare, c'est le cas quotidien.
 *
 * Ensuite, `resolve-puuid` répondait « Joueur introuvable (401) » : la
 * personne qui relie son compte lit que SON pseudo est faux, au moment précis
 * où elle le tape pour la première fois. C'est notre configuration qui est en
 * cause, et le message accuse la sienne.
 *
 * Ici, un seul sens par code : 401 reste réservé à l'absence de session.
 */

export type RefusRiot = { message: string; statut: number };

/**
 * Traduit le code rendu par Riot en réponse à nous.
 *
 * @param statut Le code HTTP de la réponse de Riot.
 * @param introuvable Ce qu'on dit pour un 404, qui dépend de la route : une
 *   partie absente et un joueur inconnu ne se corrigent pas pareil.
 */
export function refusRiot(statut: number, introuvable: string): RefusRiot {
  // Riot refuse NOTRE clé. 403 plutôt que 401 : ce n'est pas la personne qui
  // manque d'autorisation, c'est le serveur, et 401 doit rester lisible comme
  // « ta session a expiré ».
  if (statut === 401 || statut === 403) {
    return {
      message: "Le suivi Riot est momentanément coupé : notre clé n'est plus acceptée. Tes parties s'enregistrent à la main en attendant.",
      statut: 403,
    };
  }
  if (statut === 404) return { message: introuvable, statut: 404 };
  // Riot nous freine. Le code passe tel quel : le journal sait déjà le lire, et
  // la conduite à tenir est la même — attendre.
  if (statut === 429) {
    return { message: "Riot limite les requêtes en ce moment. Réessaie dans une minute.", statut: 429 };
  }
  // Tout le reste vient de chez eux : 502 le dit, là où un 500 laisserait
  // croire que c'est nous.
  return { message: "Riot ne répond pas correctement pour le moment.", statut: 502 };
}
