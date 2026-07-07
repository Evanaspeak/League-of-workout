import { auth } from "@/auth";
import LandingClient from "./LandingClient";

export const metadata = {
  title: "Win or Workout — Gagne ta game, ou paie en pompes",
  description: "Win or Workout suit tes parties et calcule ta dette de pompes après chaque game, selon ta performance. League of Legends aujourd'hui — d'autres jeux bientôt.",
};

export default async function LandingPage() {
  // On lit la session pour adapter le bouton de la nav, mais on NE redirige plus :
  // la page d'accueil reste accessible même connecté.
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return <LandingClient isLoggedIn={isLoggedIn} />;
}
