import Link from "next/link";
import { LoginButtons } from "@/components/LoginButtons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; transferred?: string }>;
}) {
  const { error, transferred } = await searchParams;
  const betaFull = error === "AccessDenied";

  if (transferred === "1") {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="lol-panel p-8 w-full max-w-sm space-y-4 text-center">
          <div className="text-4xl">✓</div>
          <p className="gold-text font-bold text-lg">Connexion réussie</p>
          <p className="text-sm" style={{ color: "rgba(240,230,211,0.6)" }}>
            Vous êtes connecté dans l&apos;application. Vous pouvez fermer cet onglet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="lol-panel p-8 w-full max-w-sm space-y-6 text-center">
        <div>
          <h1 className="gold-text font-bold text-2xl tracking-widest">⚔ LEAGUE OF WORKOUTS</h1>
          <p className="text-sm mt-2" style={{ color: "rgba(240,230,211,0.6)" }}>
            Accès réservé aux beta-testeurs
          </p>
        </div>

        {betaFull ? (
          <div className="space-y-3">
            <div className="p-4 rounded" style={{ background: "rgba(200,70,70,0.12)", border: "1px solid rgba(200,70,70,0.3)" }}>
              <p className="loss-text font-semibold">Beta complète</p>
              <p className="text-sm mt-1" style={{ color: "rgba(240,230,211,0.6)" }}>
                Les 100 places de beta sont déjà prises.
              </p>
            </div>
            <Link href="/waitlist" className="lol-btn inline-block text-sm">
              Rejoindre la liste d&apos;attente
            </Link>
          </div>
        ) : (
          <LoginButtons />
        )}
      </div>
    </div>
  );
}
