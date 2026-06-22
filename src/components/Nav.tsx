"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/lib/SessionContext";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/history", label: "Historique" },
  { href: "/settings", label: "Réglages" },
];

export default function Nav() {
  const path = usePathname();
  const { sessionActive, sessionGames, countdown, polling, stopSession } = useSession();

  return (
    <nav style={{ background: "var(--lol-dark-mid)", borderBottom: "1px solid rgba(200,170,110,0.25)" }}>
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 h-14">
        <span className="gold-text font-bold text-lg mr-4 tracking-widest">⚔ LOW</span>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="px-3 py-1.5 text-sm rounded transition-colors"
            style={{
              color: path === l.href ? "#c8aa6e" : "rgba(240,230,211,0.6)",
              background: path === l.href ? "rgba(200,170,110,0.12)" : "transparent",
              fontWeight: path === l.href ? "600" : "400",
            }}
          >
            {l.label}
          </Link>
        ))}

        {sessionActive && (
          <div className="ml-auto flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1 rounded"
              style={{ background: "rgba(76,175,80,0.1)", border: "1px solid rgba(76,175,80,0.3)" }}>
              <div className="w-2 h-2 rounded-full shrink-0"
                style={{ background: "#4caf50", boxShadow: "0 0 6px #4caf50", animation: "pulse 1.5s infinite" }} />
              <span className="text-xs win-text font-semibold">Session</span>
              <span className="text-xs gold-text">{sessionGames.length} game{sessionGames.length > 1 ? "s" : ""}</span>
              <span className="text-xs" style={{ color: "rgba(240,230,211,0.4)" }}>
                {polling ? "⟳" : `${countdown}s`}
              </span>
            </div>
            <button
              onClick={stopSession}
              className="text-xs px-2 py-1 rounded"
              style={{ background: "rgba(200,70,70,0.15)", color: "#e05555", border: "1px solid rgba(200,70,70,0.3)" }}
            >
              ⏹
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
