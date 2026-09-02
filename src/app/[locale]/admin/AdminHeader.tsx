import { textes } from "@/lib/i18n/textes";
import { toLocale } from "@/lib/i18n/langues";
import { adminHeader } from "@/lib/i18n/dictionaries/adminHeader";

/**
 * Rendu au SERVEUR : il n'était client que pour `useT`.
 */
export default function AdminHeader(
  { email, locale }: { email: string; locale: string },
) {
  const t = textes(adminHeader, toLocale(locale));

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
