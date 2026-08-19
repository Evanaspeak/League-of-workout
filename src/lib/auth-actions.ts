"use server";
import { signIn, signOut } from "@/auth";

/**
 * Fermer la session en cours avant d'en ouvrir une autre.
 *
 * Auth.js, quand un cookie de session est déjà là, ne connecte PAS le compte
 * OAuth choisi : il le RATTACHE à l'utilisateur courant et rend la session
 * d'origine (`handle-login.js` : « If the user is already signed in […] we can
 * go ahead and link the accounts safely »). Sur un poste où deux comptes
 * Google cohabitent, on croyait donc changer de compte et on repartait
 * toujours avec le premier — pendant que la seconde adresse se retrouvait
 * silencieusement rattachée à celui-ci.
 *
 * Depuis la page de connexion, « se connecter avec Google » veut dire se
 * connecter avec CE compte, jamais le greffer sur un autre. On efface donc
 * d'abord.
 */
async function fermerSessionCourante() {
  try {
    await signOut({ redirect: false });
  } catch {
    // Pas de session à fermer : c'est le cas nominal, on continue.
  }
}

// ?li=1 signale au SessionGuard qu'il s'agit d'une première connexion (pas d'un restart navigateur).
// On vise /dashboard directement (et pas la landing page "/") pour éviter un
// aller-retour de redirection qui perd le paramètre li.
export async function signInWithGoogle() {
  await fermerSessionCourante();
  await signIn("google", { redirectTo: "/dashboard?li=1" });
}

export async function signInWithDiscord() {
  await fermerSessionCourante();
  await signIn("discord", { redirectTo: "/dashboard?li=1" });
}
