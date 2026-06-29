"use server";
import { signIn } from "@/auth";

// ?li=1 signale au SessionGuard qu'il s'agit d'une première connexion (pas d'un restart navigateur).
// On vise /dashboard directement (et pas la landing page "/") pour éviter un
// aller-retour de redirection qui perd le paramètre li.
export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/dashboard?li=1" });
}

export async function signInWithDiscord() {
  await signIn("discord", { redirectTo: "/dashboard?li=1" });
}
