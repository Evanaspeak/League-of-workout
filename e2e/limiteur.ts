import "dotenv/config";
import { Client } from "pg";

/**
 * Remet le compteur de tentatives à zéro.
 *
 * Le budget d'inscription est de cinq par quart d'heure. C'est le bon chiffre
 * pour une vraie inscription, et il ne tient pas une suite de tests : chaque
 * fichier de parcours ouvre son propre compte, et le sixième se faisait
 * refuser. La panne ne ressemblait pas à sa cause — c'est le fichier ajouté en
 * dernier qui échouait, quel qu'il soit, et il passait seul.
 *
 * La purge vivait déjà dans la préparation globale, mais une seule fois avant
 * toute la suite : elle ne pouvait rien contre les inscriptions que la suite
 * fait elle-même. Elle est donc appelée par chaque ouverture de compte.
 *
 * Le limiteur a ses propres tests, qui l'éprouvent pour de bon. Ici il ne
 * compterait que les exécutions successives de la suite.
 */
export async function purgerTentatives() {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  const client = new Client({ connectionString: url });
  try {
    await client.connect();
    await client.query('DELETE FROM "LoginAttempt"');
  } catch {
    /* la suite dira elle-même si le limiteur mord */
  } finally {
    await client.end().catch(() => {});
  }
}
