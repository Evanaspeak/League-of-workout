"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/SessionContext";
import { useT } from "@/lib/i18n/LocaleContext";
import { nav as navDict } from "@/lib/i18n/dictionaries/nav";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Wordmark } from "./Wordmark";

const ADMIN_EMAIL = "evantocquet@gmail.com";

const PUBLIC_PATHS = ["/login", "/waitlist", "/"];
// Ces pages gèrent leur propre chrome (nav intégrée) : pas de double barre.
const SELF_CHROMED = ["/", "/beta", "/recuperation"];

export default function Nav() {
  const path = usePathname();
  const { sessionActive, sessionGames, countdown, polling, stopSession } = useSession();
  const [isAdmin, setIsAdmin] = useState(false);
  const t = useT(navDict);

  const links = [
    { href: "/dashboard", label: t.dashboard },
    { href: "/history", label: t.historique },
    { href: "/settings", label: t.reglages },
  ];

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => { if (s?.user?.email === ADMIN_EMAIL) setIsAdmin(true); })
      .catch(() => {});
  }, []);

  if (SELF_CHROMED.some((p) => (p === "/" ? path === "/" : path.startsWith(p)))) {
    return null;
  }

  const isPublic = PUBLIC_PATHS.some((p) => (p === "/" ? path === "/" : path.startsWith(p)));

  return (
    <nav style={{
      background: "rgba(12,14,17,0.85)",
      backdropFilter: "blur(14px)",
      WebkitBackdropFilter: "blur(14px)",
      borderBottom: "1px solid var(--line)",
      position: "sticky",
      top: 0,
      zIndex: 40,
    }}>
      <div className="max-w-6xl mx-auto px-4 flex items-center gap-1 h-14">
        <Link
          href="/"
          style={{ textDecoration: "none", marginRight: "1.75rem", flexShrink: 0, display: "inline-flex" }}
        >
          <Wordmark fontSize="1.05rem" />
        </Link>

        {!isPublic && [...links, ...(isAdmin ? [{ href: "/admin", label: t.admin }] : [])].map((l) => {
          const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                position: "relative",
                padding: "4px 10px",
                paddingBottom: 6,
                fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
                fontSize: "0.92rem",
                fontWeight: active ? 600 : 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: active ? "var(--bone)" : "var(--faint)",
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
                  background: "var(--ember)",
                  transform: "skewX(-18deg)",
                }} />
              )}
            </Link>
          );
        })}

        <div className="ml-auto flex items-center gap-2 shrink-0">
          {!isPublic && sessionActive && (
            <>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "4px 12px",
              borderRadius: 999,
              background: "var(--victory-soft)",
              border: "1px solid rgba(47,217,138,0.3)",
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: "var(--victory)",
                animation: "pulse 1.5s ease-in-out infinite",
                display: "inline-block",
              }} />
              <span style={{ fontSize: "0.7rem", color: "var(--victory)", fontWeight: 700, letterSpacing: "0.06em" }}>{t.live}</span>
              <span className="mono-num" style={{ fontSize: "0.7rem", color: "var(--bone)" }}>{sessionGames.length}G</span>
              <span className="mono-num" style={{ fontSize: "0.7rem", color: "var(--faint)" }}>
                {polling ? "⟳" : `${countdown}s`}
              </span>
            </div>
            <button
              onClick={stopSession}
              title={t.stopSession}
              aria-label={t.stopSession}
              style={{
                width: 28, height: 28,
                borderRadius: "50%",
                background: "rgba(255,90,71,0.12)",
                border: "1px solid rgba(255,90,71,0.3)",
                color: "var(--loss)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor" aria-hidden>
                <rect width="9" height="9" rx="1.5" />
              </svg>
            </button>
            </>
          )}
          <LanguageSwitcher />
        </div>
      </div>
    </nav>
  );
}
