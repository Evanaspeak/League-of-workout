"use server";
import { signIn } from "@/auth";

// ?li=1 signale au SessionGuard qu'il s'agit d'une première connexion (pas d'un restart navigateur).
export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/?li=1" });
}

export async function signInWithDiscord() {
  await signIn("discord", { redirectTo: "/?li=1" });
}
