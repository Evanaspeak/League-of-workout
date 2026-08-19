import { ConnexionAppClient } from "./ConnexionAppClient";

/**
 * Point d'entrée de la connexion demandée par l'application desktop.
 *
 * L'application ouvrait le navigateur sur la page de connexion ordinaire, où
 * il fallait re-choisir « Google » alors qu'on venait précisément de le
 * demander depuis l'application. Cette page-ci arme le transfert puis part
 * d'elle-même chez le fournisseur : un seul choix de compte, aucun clic en
 * trop, et une page de moins où quelque chose peut se perdre.
 */
export default async function ConnexionApp({
  searchParams,
}: {
  searchParams: Promise<{ n?: string; p?: string }>;
}) {
  const { n, p } = await searchParams;
  return <ConnexionAppClient nonce={n ?? ""} fournisseur={p === "discord" ? "discord" : "google"} />;
}
