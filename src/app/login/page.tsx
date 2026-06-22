import { signIn } from "@/auth";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const betaFull = error === "AccessDenied";

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
          <div className="space-y-3">
            <form
              action={async () => {
                "use server";
                await signIn("google", { redirectTo: "/" });
              }}
            >
              <button type="submit" className="lol-btn w-full">
                Se connecter avec Google
              </button>
            </form>

            <form
              action={async () => {
                "use server";
                await signIn("discord", { redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="lol-btn w-full"
                style={{ background: "linear-gradient(to bottom, #5865F2, #404EED)", color: "#fff" }}
              >
                Se connecter avec Discord
              </button>
            </form>

            <p className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
              Seuls les 100 premiers inscrits ont accès pendant la beta.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
