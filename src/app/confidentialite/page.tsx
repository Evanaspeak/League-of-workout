import Link from "next/link";

const CONTACT = "evantocquet@gmail.com";
const DATE = "26 juin 2026";

export const metadata = { title: "Confidentialité — League of Workouts" };

export default function ConfidentialitePage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }} className="space-y-8 py-4">
      <div>
        <h1 style={{
          fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
          fontSize: "1.4rem", color: "#C8AA6E", letterSpacing: "0.16em",
        }}>
          POLITIQUE DE CONFIDENTIALITÉ
        </h1>
        <p style={{ fontSize: "0.78rem", color: "rgba(240,230,211,0.35)", marginTop: "0.5rem" }}>
          Version bêta · En vigueur au {DATE} · Conforme au RGPD
        </p>
      </div>

      <Section title="1. Responsable du traitement">
        <p>
          Evan Tocquet, développeur indépendant<br />
          Contact : <a href={`mailto:${CONTACT}`} style={{ color: "#C8AA6E" }}>{CONTACT}</a>
        </p>
      </Section>

      <Section title="2. Données collectées">
        <p>L'Application collecte uniquement les données nécessaires à son fonctionnement :</p>
        <table>
          <thead>
            <tr>
              <th>Donnée</th>
              <th>Source</th>
              <th>Finalité</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Adresse email</td>
              <td>Inscription / OAuth</td>
              <td>Identification du compte</td>
            </tr>
            <tr>
              <td>Nom d'affichage</td>
              <td>Inscription / OAuth</td>
              <td>Affichage dans l'interface</td>
            </tr>
            <tr>
              <td>Photo de profil</td>
              <td>OAuth (Google/Discord)</td>
              <td>Affichage dans l'interface</td>
            </tr>
            <tr>
              <td>Riot ID & PUUID</td>
              <td>Saisi par l'utilisateur</td>
              <td>Synchronisation des parties via l'API Riot</td>
            </tr>
            <tr>
              <td>Données de parties</td>
              <td>API Riot / Saisie manuelle</td>
              <td>Calcul et historique des pompes</td>
            </tr>
            <tr>
              <td>Mot de passe</td>
              <td>Inscription email</td>
              <td>Authentification (stocké haché, jamais en clair)</td>
            </tr>
          </tbody>
        </table>
        <p>
          Aucune donnée de santé au sens médical, aucun moyen de paiement, et aucune donnée
          de localisation ne sont collectés.
        </p>
      </Section>

      <Section title="3. Base légale">
        <p>
          Les traitements reposent sur votre consentement (art. 6.1.a RGPD), exprimé lors de
          la création du compte, et sur l'exécution du service auquel vous avez souscrit (art. 6.1.b).
        </p>
      </Section>

      <Section title="4. Durée de conservation">
        <p>
          Vos données sont conservées aussi longtemps que votre compte est actif. En cas de
          demande de suppression, toutes vos données personnelles sont effacées dans un délai
          de 30 jours.
        </p>
      </Section>

      <Section title="5. Partage des données">
        <p>
          Vos données ne sont jamais vendues ni cédées à des tiers à des fins commerciales.
          Elles sont partagées uniquement avec les sous-traitants techniques nécessaires au
          fonctionnement de l'Application :
        </p>
        <ul>
          <li><strong>Vercel</strong> — hébergement de l'application (États-Unis, Privacy Shield)</li>
          <li><strong>Neon</strong> — base de données PostgreSQL (États-Unis, Privacy Shield)</li>
          <li><strong>Riot Games API</strong> — récupération des données de parties publiques</li>
          <li><strong>Google / Discord</strong> — authentification OAuth (optionnel)</li>
        </ul>
      </Section>

      <Section title="6. Cookies et stockage local">
        <p>L'Application utilise :</p>
        <ul>
          <li>Un cookie de session chiffré (Auth.js) pour maintenir la connexion</li>
          <li>Le <code>localStorage</code> du navigateur pour vos préférences locales (ex : "Rester connecté", introduction vue)</li>
        </ul>
        <p>Aucun cookie publicitaire ou de traçage tiers n'est utilisé.</p>
      </Section>

      <Section title="7. Vos droits (RGPD)">
        <p>
          Conformément au Règlement Général sur la Protection des Données, vous disposez des droits suivants :
        </p>
        <ul>
          <li><strong>Droit d'accès</strong> — obtenir une copie de vos données</li>
          <li><strong>Droit de rectification</strong> — corriger des données inexactes</li>
          <li><strong>Droit à l'effacement</strong> — demander la suppression de votre compte et de toutes vos données</li>
          <li><strong>Droit à la portabilité</strong> — recevoir vos données dans un format lisible</li>
          <li><strong>Droit d'opposition</strong> — vous opposer à un traitement</li>
        </ul>
        <p>
          Pour exercer ces droits, contactez-nous à :{" "}
          <a href={`mailto:${CONTACT}`} style={{ color: "#C8AA6E" }}>{CONTACT}</a>
        </p>
        <p>
          En cas de litige non résolu, vous pouvez saisir la{" "}
          <strong>CNIL</strong> (Commission Nationale de l'Informatique et des Libertés) à l'adresse{" "}
          <span style={{ color: "rgba(200,170,110,0.7)" }}>www.cnil.fr</span>.
        </p>
      </Section>

      <Section title="8. Sécurité">
        <p>
          Les mots de passe sont stockés de façon irréversible (hachage bcrypt). Les communications
          sont chiffrées via HTTPS. L'accès à la base de données est restreint et authentifié.
        </p>
      </Section>

      <Section title="9. Modifications">
        <p>
          Cette politique peut être mise à jour. La date de dernière modification est indiquée en
          haut de cette page. Les changements significatifs seront signalés lors de votre prochaine
          connexion.
        </p>
      </Section>

      <div style={{ paddingTop: "1rem", borderTop: "1px solid rgba(200,170,110,0.1)" }}>
        <Link href="/cgu" style={{ color: "rgba(200,170,110,0.6)", fontSize: "0.82rem" }}>
          → Conditions Générales d'Utilisation
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
