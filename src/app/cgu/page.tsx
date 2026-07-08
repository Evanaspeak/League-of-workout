import CguClient from "./CguClient";

export const metadata = {
  title: "CGU",
  description: "Conditions générales d'utilisation de Win or Workout.",
  alternates: { canonical: "/cgu" },
};

export default function CGUPage() {
  return <CguClient />;
}
