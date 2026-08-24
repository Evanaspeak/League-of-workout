"use server";
import { signOut } from "@/auth";

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

// La suppression de compte a quitté ce fichier pour `DELETE /api/user`.
// Une action serveur qui échoue ne rejette pas côté client : elle remonte
// l'erreur à la page, le `await` ne rend jamais la main, et l'écran reste
// bloqué sur « Suppression… ». Mesuré, puis déplacé.
