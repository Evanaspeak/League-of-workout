import type { Metadata } from "next";
import { ConnexionAppClient } from "./ConnexionAppClient";

/**
 * Elle ne doit pas sortir dans une recherche, et il faut le DIRE.
 *
 * Elle est publique — exiger une session pour aller s'en créer une n'aurait
 * pas de sens — donc explorable, et elle n'était ni dans le plan du site ni
 * marquée. Une page dans cet état s'indexe depuis n'importe quel lien et
 * paraît sans titre ni description, ce qui est le pire des deux mondes : c'est
 * mot pour mot la leçon écrite dans `robots.ts` au départ de `/waitlist`, et
 * elle n'avait pas été appliquée ici.
 *
 * Le refus se pose sur la page et non dans `robots.txt` : interdire
 * l'exploration n'empêche pas l'indexation, elle empêche seulement de LIRE ce
 * refus. Les deux autres pages du même genre — connexion et récupération — le
 * portaient déjà.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };


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
