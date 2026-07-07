import type { Locale } from "./LocaleContext";

/**
 * Les routes API renvoient leurs messages d'erreur en français en dur.
 * Cette table les traduit côté client au moment de l'affichage plutôt que
 * de dupliquer la logique de langue dans chaque route.
 */
const ERROR_MAP: Record<string, string> = {
  "Unauthorized": "Unauthorized",
  "Accès refusé": "Access denied",
  "Erreur serveur": "Server error",
  "Erreur base de données": "Database error",
  "Champs manquants": "Missing fields",
  "Email invalide": "Invalid email",
  "Mot de passe trop court (min 8 caractères)": "Password too short (min 8 characters)",
  "Pseudo trop court (min 2 caractères)": "Username too short (min 2 characters)",
  "Un compte existe déjà avec cet email": "An account with this email already exists",
  "Beta complète — les 100 places sont prises.": "Beta full — all 100 spots are taken.",
  "Utilisateur introuvable": "User not found",
  "Ce compte utilise Google ou Discord — pas de mot de passe à réinitialiser": "This account uses Google or Discord — no password to reset",
  "Statut invalide": "Invalid status",
  "Champion invalide": "Invalid champion",
  "Rôle invalide": "Invalid role",
  "PUUID manquant. Configure ton Riot ID dans Réglages.": "Missing PUUID. Set up your Riot ID in Settings.",
  "Riot ID manquant": "Missing Riot ID",
  "Partie introuvable": "Game not found",
  "Date invalide": "Invalid date",
  "Identifiants invalides": "Invalid credentials",
  "Trop de tentatives. Réessaie plus tard.": "Too many attempts. Try again later.",
};

export function translateApiError(message: string | undefined | null, locale: Locale): string {
  if (!message) return "";
  if (locale === "fr") return message;
  return ERROR_MAP[message] ?? message;
}
