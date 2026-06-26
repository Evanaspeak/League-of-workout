import Link from "next/link";

const CONTACT = "evantocquet@gmail.com";
const DATE = "26 juin 2026";

export const metadata = { title: "CGU — League of Workouts" };

export default function CGUPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }} className="space-y-8 py-4">
      <div>
        <h1 style={{
          fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
          fontSize: "1.4rem", color: "#C8AA6E", letterSpacing: "0.16em",
        }}>
          CONDITIONS GÉNÉRALES D'UTILISATION
        </h1>
        <p style={{ fontSize: "0.78rem", color: "rgba(240,230,211,0.35)", marginTop: "0.5rem" }}>
          Version bêta · En vigueur au {DATE}
        </p>
      </div>

      <Section title="1. Présentation">
        <p>
          League of Workouts (ci-après « l'Application ») est un service développé et exploité par
          Evan Tocquet, développeur indépendant (ci-après « l'Éditeur »). L'Application propose
          un suivi gamifié de l'activité physique basé sur les performances en jeu sur League of Legends.
        </p>
        <p>
          L'accès à l'Application est actuellement limité à une phase bêta fermée de 100 utilisateurs maximum.
        </p>
      </Section>

      <Section title="2. Acceptation des CGU">
        <p>
          L'utilisation de l'Application implique l'acceptation pleine et entière des présentes Conditions
          Générales d'Utilisation. Si vous n'acceptez pas ces conditions, vous devez cesser d'utiliser
          l'Application immédiatement.
        </p>
      </Section>

      <Section title="3. Accès à l'Application">
        <p>
          L'Application est accessible via le navigateur web et une application de bureau (Windows/Mac).
          L'accès est réservé aux utilisateurs invités durant la phase bêta. L'Éditeur se réserve le droit
          de modifier les conditions d'accès à tout moment.
        </p>
        <p>
          L'utilisation nécessite un compte créé via Google, Discord ou email/mot de passe, et
          optionnellement un compte Riot Games pour la synchronisation automatique des parties.
        </p>
      </Section>

      <Section title="4. Utilisation acceptable">
        <p>L'utilisateur s'engage à :</p>
        <ul>
          <li>Ne pas tenter de contourner les limites d'accès ou de falsifier des données de jeu</li>
          <li>Ne pas utiliser l'Application à des fins commerciales sans autorisation préalable</li>
          <li>Ne pas porter atteinte au bon fonctionnement du service</li>
          <li>Fournir des informations exactes lors de la création du compte</li>
        </ul>
      </Section>

      <Section title="5. Propriété intellectuelle">
        <p>
          L'Application, son code, son design et ses contenus sont la propriété exclusive d'Evan Tocquet.
          Toute reproduction ou utilisation non autorisée est interdite.
        </p>
        <p>
          League of Legends et les données associées sont la propriété de Riot Games, Inc.
          League of Workouts n'est pas affilié à Riot Games et utilise l'API Riot Games conformément
          à ses conditions d'utilisation.
        </p>
      </Section>

      <Section title="6. Limitation de responsabilité">
        <p>
          L'Application est fournie en l'état, sans garantie d'aucune sorte. L'Éditeur ne saurait être
          tenu responsable des interruptions de service, pertes de données ou dommages indirects liés
          à l'utilisation de l'Application.
        </p>
        <p>
          Les recommandations d'exercice générées par l'Application sont données à titre indicatif.
          L'utilisateur est seul responsable de l'activité physique qu'il pratique et doit consulter
          un médecin en cas de doute sur ses capacités physiques.
        </p>
      </Section>

      <Section title="7. Modification et résiliation">
        <p>
          L'Éditeur se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs
          seront informés des changements majeurs. L'Éditeur peut suspendre ou supprimer un compte
          en cas de non-respect des présentes conditions.
        </p>
      </Section>

      <Section title="8. Droit applicable">
        <p>
          Les présentes CGU sont soumises au droit français. Tout litige sera soumis aux tribunaux
          compétents du ressort de la juridiction de l'Éditeur.
        </p>
      </Section>

      <Section title="9. Contact">
        <p>
          Pour toute question relative aux présentes CGU :{" "}
          <a href={`mailto:${CONTACT}`} style={{ color: "#C8AA6E" }}>{CONTACT}</a>
        </p>
      </Section>

      <div style={{ paddingTop: "1rem", borderTop: "1px solid rgba(200,170,110,0.1)" }}>
        <Link href="/confidentialite" style={{ color: "rgba(200,170,110,0.6)", fontSize: "0.82rem" }}>
          → Politique de confidentialité
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
