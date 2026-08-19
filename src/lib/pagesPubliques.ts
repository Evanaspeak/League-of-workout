/**
 * Pages qui s'adressent à des visiteurs plutôt qu'à un compte connecté.
 * Le rail latéral — dette en attente et actions — n'y a rien à faire, et la
 * mise en page n'y réserve donc aucune marge pour lui.
 */
export const PAGES_PUBLIQUES = [
  "/", "/beta", "/login", "/waitlist", "/cgu", "/confidentialite",
  "/telechargement", "/recuperation", "/connexion-app",
];

/**
 * Vrai pour une page publique **et pour ses sous-pages**.
 *
 * L'égalité stricte laissait `/recuperation/valider` du côté des pages
 * connectées : le rail, la modale d'accueil et la visite s'y invitaient alors
 * qu'on y arrive par un lien reçu par e-mail, sans compte ouvert.
 *
 * La comparaison porte sur des segments entiers, jamais sur un préfixe de
 * texte : `startsWith("/login")` aurait aussi reconnu une hypothétique
 * `/loginement`. Et « / » reste exacte, sans quoi elle reconnaîtrait tout.
 */
export function estPagePublique(chemin: string | null | undefined): boolean {
  const c = chemin ?? "";
  if (c === "/") return true;
  return PAGES_PUBLIQUES.some((p) => p !== "/" && (c === p || c.startsWith(`${p}/`)));
}
