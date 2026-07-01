"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { confidentialite } from "@/lib/i18n/dictionaries/confidentialite";

const CONTACT = "evantocquet@gmail.com";
const DATE = "26 juin 2026";

export default function ConfidentialiteClient() {
  const t = useT(confidentialite);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }} className="space-y-8 py-4">
      <div>
        <h1 style={{
          fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
          fontSize: "1.4rem", color: "#C8AA6E", letterSpacing: "0.16em",
        }}>
          {t.pageTitle}
        </h1>
        <p style={{ fontSize: "0.78rem", color: "rgba(240,230,211,0.35)", marginTop: "0.5rem" }}>
          {t.versionLabel(DATE)}
        </p>
      </div>

      <Section title={t.article1.title}>
        <p>
          {t.article1.role}<br />
          {t.article1.contactLabel} <a href={`mailto:${CONTACT}`} style={{ color: "#C8AA6E" }}>{CONTACT}</a>
        </p>
      </Section>

      <Section title={t.article2.title}>
        <p>{t.article2.intro}</p>
        <table>
          <thead>
            <tr>
              {t.article2.tableHeaders.map((h, i) => <th key={i}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {t.article2.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => <td key={j}>{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p>{t.article2.outro}</p>
      </Section>

      <Section title={t.article3.title}>
        {t.article3.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </Section>

      <Section title={t.article4.title}>
        {t.article4.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </Section>

      <Section title={t.article5.title}>
        <p>{t.article5.intro}</p>
        <ul>
          {t.article5.items.map((item, i) => (
            <li key={i}><strong>{item.label}</strong> {item.text}</li>
          ))}
        </ul>
      </Section>

      <Section title={t.article6.title}>
        <p>{t.article6.intro}</p>
        <ul>
          <li>{t.article6.items[0]}</li>
          <li>{t.article6.localStoragePrefix} <code>localStorage</code>{t.article6.localStorageSuffix ? ` ${t.article6.localStorageSuffix}` : ""} {t.article6.items[1]}</li>
        </ul>
        <p>{t.article6.outro}</p>
      </Section>

      <Section title={t.article7.title}>
        <p>{t.article7.intro}</p>
        <ul>
          {t.article7.items.map((item, i) => (
            <li key={i}><strong>{item.label}</strong> {item.text}</li>
          ))}
        </ul>
        <p>
          {t.article7.exerciseLabel}{" "}
          <a href={`mailto:${CONTACT}`} style={{ color: "#C8AA6E" }}>{CONTACT}</a>
        </p>
        <p>
          {t.article7.cnilPrefix}{" "}
          <strong>{t.article7.cnilName}</strong> {t.article7.cnilFull}{" "}
          <span style={{ color: "rgba(200,170,110,0.7)" }}>www.cnil.fr</span>.
        </p>
      </Section>

      <Section title={t.article8.title}>
        {t.article8.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </Section>

      <Section title={t.article9.title}>
        {t.article9.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </Section>

      <div style={{ paddingTop: "1rem", borderTop: "1px solid rgba(200,170,110,0.1)" }}>
        <Link href="/cgu" style={{ color: "rgba(200,170,110,0.6)", fontSize: "0.82rem" }}>
          {t.footerLink}
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 style={{
        fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
        fontSize: "0.8rem", color: "#C8AA6E", letterSpacing: "0.12em",
      }}>
        {title}
      </h2>
      <div style={{
        fontSize: "0.875rem",
        color: "rgba(240,230,211,0.6)",
        lineHeight: 1.8,
      }} className="space-y-2">
        {children}
      </div>
    </div>
  );
}
