"use server";
import { signIn } from "@/auth";

export async function signInWithGoogle() {
  await signIn("google", { redirectTo: "/" });
}

export async function signInWithDiscord() {
  await signIn("discord", { redirectTo: "/" });
}
