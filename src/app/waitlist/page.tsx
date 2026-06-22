import Link from "next/link";

export default function WaitlistPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="lol-panel p-8 w-full max-w-sm space-y-5 text-center">
        <div className="text-4xl">⏳</div>
        <h1 className="gold-text font-bold text-xl tracking-widest">LISTE D&apos;ATTENTE</h1>
        <p className="text-sm" style={{ color: "rgba(240,230,211,0.7)" }}>
          La beta est limitée à 100 testeurs et toutes les places sont prises.
          Une prochaine vague d&apos;accès est prévue — reviens bientôt !
        </p>
        <Link href="/login" className="lol-btn inline-block text-sm">
          Retour
        </Link>
      </div>
    </div>
  );
}
