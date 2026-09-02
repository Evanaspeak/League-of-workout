import { Lien } from "@/components/Lien";
import { CONTACT_LEGAL, DATE_ENTREE_EN_VIGUEUR } from "@/lib/mentionsLegales";
import { textes } from "@/lib/i18n/textes";
import { toLocale } from "@/lib/i18n/langues";
import { cgu } from "@/lib/i18n/dictionaries/cgu";



/**
 * Rendu au SERVEUR, et c'est ce qui compte ici.
 *
 * Ce composant n'avait aucun état, aucun gestionnaire, aucune lecture du
 * navigateur : il était client pour la seule raison qu'il appelait `useT`. Son
 * dictionnaire partait donc dans le paquet JavaScript, dans les six langues, à
 * chaque visite — pour un texte qui ne bouge jamais et que le serveur sait
 * rendre entièrement.
 *
 * `textes(dict, locale)` fait au serveur ce que `useT` fait au navigateur. La
 * langue vient du paramètre de route, ce qui n'était possible qu'une fois la
 * langue dans l'adresse : c'est le bénéfice différé de ce chantier-là.
 */
export default function CguClient({ locale }: { locale: string }) {
  const t = textes(cgu, toLocale(locale));

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }} className="space-y-8 py-4">
      <div>
        <h1 className="titre-page">
          {t.pageTitle}
        </h1>
        <p style={{ fontSize: "0.78rem", color: "var(--faint)", marginTop: "0.5rem" }}>
          {t.versionLabel(DATE_ENTREE_EN_VIGUEUR)}
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
        <ul className="liste-puces">
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
          <a href={`mailto:${CONTACT_LEGAL}`} style={{ color: "#ECEFF4" }}>{CONTACT_LEGAL}</a>
        </p>
      </Section>

      <div style={{ paddingTop: "1rem", borderTop: "1px solid rgba(152,162,176,0.1)" }}>
        <Lien href="/confidentialite" style={{ color: "var(--steel)", fontSize: "0.82rem" }}>
          {t.footerLink}
        </Lien>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="titre-section">{title}</h2>
      <div style={{
        fontSize: "0.875rem",
        color: "var(--muted)",
        lineHeight: 1.8,
      }} className="space-y-2">
        {children}
      </div>
    </div>
  );
}
