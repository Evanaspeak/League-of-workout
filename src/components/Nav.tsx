"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/game", label: "Dernière Game" },
  { href: "/history", label: "Historique" },
  { href: "/profile", label: "Profil" },
  { href: "/settings", label: "Réglages" },
];

export default function Nav() {
  const path = usePathname();
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
      </div>
    </nav>
  );
}
