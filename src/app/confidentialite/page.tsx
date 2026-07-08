import ConfidentialiteClient from "./ConfidentialiteClient";

export const metadata = {
  title: "Confidentialité",
  description: "Politique de confidentialité de Win or Workout : données collectées, usage et droits.",
  alternates: { canonical: "/confidentialite" },
};

export default function ConfidentialitePage() {
  return <ConfidentialiteClient />;
}
