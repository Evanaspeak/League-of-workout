import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Récupération de compte",
  robots: { index: false },
};

export default function RecuperationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
