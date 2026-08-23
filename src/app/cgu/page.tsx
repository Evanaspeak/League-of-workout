import CguClient from "./CguClient";

export const metadata = {
  title: "CGU",
  description:
    "Conditions générales d'utilisation de Win or Workout : ce que le service "
    + "fait, ce qu'il ne fait pas, et les règles de santé qui l'encadrent.",
  alternates: { canonical: "/cgu" },
};

export default function CGUPage() {
  return <CguClient />;
}
