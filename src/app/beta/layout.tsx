import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accès bêta — un pseudo suffit",
  description:
    "Rejoins la bêta de Win or Workout en 30 secondes : entre un pseudo, reçois ton code d'accès, et commence à payer tes défaites en pompes.",
  alternates: { canonical: "/beta" },
};

export default function BetaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
