"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/SessionContext";

const ADMIN_EMAIL = "evantocquet@gmail.com";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/history", label: "Historique" },
  { href: "/settings", label: "Réglages" },
];

const PUBLIC_PATHS = ["/login", "/waitlist", "/"];

export default function Nav() {
  const path = usePathname();
  const { sessionActive, sessionGames, countdown, polling, stopSession } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => { if (s?.user?.email === ADMIN_EMAIL) setIsAdmin(true); })
      .catch(() => {});
  }, []);
  const isPublic = PUBLIC_PATHS.some((p) => (p === "/" ? path === "/" : path.startsWith(p)));

  return (
    <nav style={{
      background: "rgba(4,8,16,0.88)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      borderBottom: "1px solid rgba(200,170,110,0.16)",
      position: "sticky",
      top: 0,
      zIndex: 40,
    }}>
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 h-14">
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
            fontSize: "1rem",
            letterSpacing: "0.14em",
            color: "#C8AA6E",
            textShadow: "0 0 22px rgba(200,170,110,0.5)",
            textDecoration: "none",
            marginRight: "1.5rem",
            flexShrink: 0,
          }}
        >
          ⚔ L·O·W
        </Link>

        {!isPublic && [...links, ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : [])].map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                position: "relative",
                padding: "4px 10px",
                paddingBottom: 6,
                fontSize: "0.78rem",
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: active ? "#C8AA6E" : "rgba(240,230,211,0.45)",
                fontWeight: active ? "600" : "400",
                textDecoration: "none",
                transition: "color 0.15s",
                whiteSpace: "nowrap",
              }}
            >
              {l.label}
              {active && (
                <span style={{
                  position: "absolute",
                  bottom: 0,
                  left: 10,
                  right: 10,
                  height: 2,
                  background: "linear-gradient(to right, transparent, #C8AA6E, transparent)",
                  borderRadius: 1,
                }} />
              )}
            </Link>
          );
        })}

        {!isPublic && sessionActive && (
          <div className="ml-auto flex items-center gap-2 shrink-0">
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "4px 12px",
              borderRadius: 999,
              background: "rgba(34,197,94,0.07)",
              border: "1px solid rgba(34,197,94,0.25)",
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: "#22C55E",
                boxShadow: "0 0 6px #22C55E",
                animation: "pulse 1.5s ease-in-out infinite",
                display: "inline-block",
              }} />
              <span style={{ fontSize: "0.7rem", color: "#22C55E", fontWeight: 700, letterSpacing: "0.06em" }}>LIVE</span>
              <span style={{ fontSize: "0.7rem", color: "#C8AA6E" }}>{sessionGames.length}G</span>
              <span style={{ fontSize: "0.7rem", color: "rgba(240,230,211,0.3)" }}>
                {polling ? "⟳" : `${countdown}s`}
              </span>
            </div>
            <button
              onClick={stopSession}
              title="Arrêter la session"
              style={{
                width: 28, height: 28,
                borderRadius: "50%",
                background: "rgba(194,59,34,0.15)",
                border: "1px solid rgba(194,59,34,0.3)",
                color: "#C23B22",
                cursor: "pointer",
                fontSize: "0.7rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              ⏹
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
