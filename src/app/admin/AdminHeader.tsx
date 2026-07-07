"use client";
import { useT } from "@/lib/i18n/LocaleContext";
import { adminHeader } from "@/lib/i18n/dictionaries/adminHeader";

export default function AdminHeader({ email }: { email: string }) {
  const t = useT(adminHeader);

  return (
    <>
      <h1 style={{
        fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
        fontSize: "1.5rem",
        color: "#ECEFF4",
        letterSpacing: "0.18em",
      }}>
        {t.title}
      </h1>
      <div className="lol-panel p-4 space-y-1">
        <p className="text-xs" style={{ color: "rgba(152,162,176,0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {t.restrictedAccess(email)}
        </p>
      </div>
    </>
  );
}
