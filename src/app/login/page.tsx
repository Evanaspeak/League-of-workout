import { LoginClient } from "./LoginClient";

export const metadata = {
  title: "Connexion",
  robots: { index: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; transferred?: string; deleted?: string }>;
}) {
  const { error, transferred, deleted } = await searchParams;
  const betaFull = error === "AccessDenied";
  const betaPending = error === "BetaPending";
  const betaRejected = error === "BetaRejected";

  return (
    <LoginClient
      betaFull={betaFull}
      betaPending={betaPending}
      betaRejected={betaRejected}
      transferred={transferred}
      deleted={deleted}
    />
  );
}
