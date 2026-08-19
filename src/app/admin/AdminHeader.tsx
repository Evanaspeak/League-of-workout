"use client";
import { useT } from "@/lib/i18n/LocaleContext";
import { adminHeader } from "@/lib/i18n/dictionaries/adminHeader";

export default function AdminHeader({ email }: { email: string }) {
  const t = useT(adminHeader);

  return (
    <>
      <h1 className="titre-page">{t.title}</h1>
      <div className="lol-panel p-4 space-y-1">
        <p className="text-xs" style={{ color: "var(--faint)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          {t.restrictedAccess(email)}
        </p>
      </div>
    </>
  );
}
