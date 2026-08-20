/**
 * Outils partagés par les tests de routes API.
 *
 * Les routes sont testées en les appelant directement, sans serveur ni base :
 * ce sont des fonctions qui prennent une requête et rendent une réponse. La
 * base et la session sont remplacées par des doublures, ce qui rend les tests
 * exécutables partout, sans PostgreSQL installé ni variables d'environnement.
 *
 * Ce fichier ne porte pas de test : `testMatch` ne retient que `*.test.ts`.
 */

/** Requête HTTP prête à passer à un handler de route. */
export function requete(
  url: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Request {
  const { method = "GET", body, headers = {} } = options;
  return new Request(`http://localhost${url}`, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json", ...headers } : headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

/** Requête au corps volontairement illisible, pour éprouver le décodage JSON. */
export function requeteCassee(url: string, method = "POST"): Request {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: "{ceci n'est pas du JSON",
  });
}

/** Adresse reconnue comme administratrice par défaut (voir `lib/admin`). */
export const EMAIL_ADMIN = "evantocquet@gmail.com";

/**
 * Utilisateur minimal, complété par les champs utiles au test. Les routes
 * n'en lisent qu'une poignée ; le typage large de Prisma n'apporterait rien
 * ici et forcerait à décrire trente colonnes sans rapport.
 */
export function utilisateur(champs: Record<string, unknown> = {}) {
  return {
    id: "u1",
    email: "joueur@example.com",
    pseudo: "Joueur",
    sessionEpoch: 0,
    exercices: ["pompes"],
    dettePointsDus: 0,
    gainageMaxSec: 60,
    ...champs,
  };
}

/** Le même, mais administrateur. */
export function admin(champs: Record<string, unknown> = {}) {
  return utilisateur({ id: "admin1", email: EMAIL_ADMIN, ...champs });
}

/** Lit le corps JSON d'une réponse de route. */
export async function corps(reponse: Response): Promise<Record<string, unknown>> {
  return reponse.json();
}
