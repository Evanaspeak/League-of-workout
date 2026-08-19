/**
 * Pages qui s'adressent à des visiteurs plutôt qu'à un compte connecté.
 * Le rail latéral — dette en attente et actions — n'y a rien à faire, et la
 * mise en page n'y réserve donc aucune marge pour lui.
 */
export const PAGES_PUBLIQUES = [
  "/", "/beta", "/login", "/waitlist", "/cgu", "/confidentialite",
  "/telechargement", "/recuperation", "/connexion-app",
];

export function estPagePublique(chemin: string | null | undefined): boolean {
  return PAGES_PUBLIQUES.includes(chemin ?? "");
}
