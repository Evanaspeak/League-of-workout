// Playwright ne charge pas le fichier d'environnement : c'est Next qui le
// fait, et la préparation tourne avant lui.
import "dotenv/config";
import { Client } from "pg";

/**
 * Remet le compteur de tentatives à zéro avant la suite.
 *
 * Le limiteur de débit protège l'inscription et la connexion, et il a ses
 * propres tests. Ici il ne ferait que compter les exécutions successives de la
 * suite jusqu'à la refuser : ce n'est pas lui qu'on éprouve, et le laisser
 * mordre rendrait les parcours faussement rouges.
 *
 * On passe par le pilote PostgreSQL directement plutôt que par le client de
 * l'application : celui-ci s'appuie sur des modules qui ne se chargent pas
 * dans le contexte de préparation de Playwright.
 */
export default async function preparer() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[e2e] DATABASE_URL absente : tentatives non purgées");
    return;
  }
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('DELETE FROM "LoginAttempt"');
    /**
     * Les comptes des exécutions précédentes s'en vont aussi.
     *
     * La bêta est plafonnée à cent comptes — c'est le produit, pas un réglage
     * de test — et chaque exécution de la suite en ouvre une dizaine. Au bout
     * d'une douzaine d'exécutions, l'ouverture de compte se met à échouer, et
     * la panne ne ressemble pas à sa cause : c'est le fichier passé en premier
     * dans l'ordre alphabétique qui tombe, quel qu'il soit.
     *
     * En intégration continue la base est neuve à chaque fois, donc ceci n'y
     * change rien. C'est pour la machine de quelqu'un.
     *
     * Le filtre porte sur le domaine `example.test`, réservé aux exemples par
     * la RFC 2606 : aucun compte réel ne peut en porter un.
     */
    await client.query(`DELETE FROM "User" WHERE email LIKE '%@example.test'`);
  } catch (e) {
    console.warn("[e2e] tentatives non purgées :", (e as Error)?.message);
  } finally {
    await client.end().catch(() => {});
  }

}
