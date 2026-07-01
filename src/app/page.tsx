import { auth } from "@/auth";
import LandingClient from "./LandingClient";

export const metadata = {
  title: "League of Workout — Transforme tes défaites en pompes",
  description: "L'application qui connecte ton compte Riot et calcule tes pompes après chaque game. Scoring intelligent basé sur ton KDA, ton rôle et ta maîtrise du champion.",
};

export default async function LandingPage() {
  // On lit la session pour adapter le bouton de la nav, mais on NE redirige plus :
  // la page d'accueil reste accessible même connecté.
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return <LandingClient isLoggedIn={isLoggedIn} />;
}
