"use client";
import Link from "next/link";
import { useT } from "@/lib/i18n/LocaleContext";
import { cgu } from "@/lib/i18n/dictionaries/cgu";

const CONTACT = "evantocquet@gmail.com";
const DATE = "26 juin 2026";

export default function CguClient() {
  const t = useT(cgu);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }} className="space-y-8 py-4">
      <div>
        <h1 style={{
          fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
          fontSize: "1.4rem", color: "#ECEFF4", letterSpacing: "0.16em",
        }}>
          {t.pageTitle}
        </h1>
        <p style={{ fontSize: "0.78rem", color: "rgba(236,239,244,0.35)", marginTop: "0.5rem" }}>
          {t.versionLabel(DATE)}
        </p>
      </div>

      <Section title={t.article1.title}>
        {t.article1.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </Section>

      <Section title={t.article2.title}>
        {t.article2.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </Section>

      <Section title={t.article3.title}>
        {t.article3.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </Section>

      <Section title={t.article4.title}>
        <p>{t.article4.intro}</p>
        <ul>
          {t.article4.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      </Section>

      <Section title={t.article5.title}>
        {t.article5.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </Section>

      <Section title={t.article6.title}>
        {t.article6.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </Section>

      <Section title={t.article7.title}>
        {t.article7.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </Section>

      <Section title={t.article8.title}>
        {t.article8.paragraphs.map((p, i) => <p key={i}>{p}</p>)}
      </Section>

      <Section title={t.article9.title}>
        <p>
          {t.article9.contactPrefix}{" "}
          <a href={`mailto:${CONTACT}`} style={{ color: "#ECEFF4" }}>{CONTACT}</a>
        </p>
      </Section>

      <div style={{ paddingTop: "1rem", borderTop: "1px solid rgba(152,162,176,0.1)" }}>
        <Link href="/confidentialite" style={{ color: "rgba(152,162,176,0.6)", fontSize: "0.82rem" }}>
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
        fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
        fontSize: "0.8rem", color: "#ECEFF4", letterSpacing: "0.12em",
      }}>
        {title}
      </h2>
      <div style={{
        fontSize: "0.875rem",
        color: "rgba(236,239,244,0.6)",
        lineHeight: 1.8,
      }} className="space-y-2">
        {children}
      </div>
    </div>
  );
}
