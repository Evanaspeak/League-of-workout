/**
 * Le souvenir d'une partie refusée à l'écran de chargement.
 *
 * Répondre « non » et enregistrer la partie sont faits par DEUX composants :
 * la question se pose au démarrage (`DetectionSession`), l'enregistrement à la
 * fin (`PartieDetectee`). Il faut donc que le refus survive entre les deux —
 * et à un rechargement de page au milieu, ce qui écarte un simple état React.
 *
 * Le souvenir vit dans le stockage du navigateur et pas dans la coquille
 * Electron, contrairement au silence de la pastille. Ce n'est pas une
 * incohérence : le silence est une décision d'AFFICHAGE, que seule la coquille
 * peut appliquer ; le sans-enjeu est une décision d'ENREGISTREMENT, prise et
 * consommée par la page. Le faire passer par le pont aurait ajouté une méthode
 * au contrat, donc une version à publier et un repli à tenir devant les
 * copies déjà installées, pour rien.
 */
import { lireJson, ecrireJson, effacer } from "@/lib/stockage";

const CLE = "low_partie_sans_enjeu";

/**
 * Au-delà de six heures, le souvenir ne parle plus de la partie en cours.
 *
 * Il est effacé à chaque démarrage de partie, donc ce délai ne devrait jamais
 * servir. Il est là pour le cas qui ne se voit pas : un démarrage manqué —
 * application relancée en cours de partie, événement perdu — ferait sinon
 * marquer sans enjeu une partie que personne n'a refusée, et le compteur de
 * dette resterait muet sans qu'on sache pourquoi.
 */
export const PEREMPTION_MS = 6 * 60 * 60 * 1000;

type Marque = { le: number };

/** On vient de refuser la session : la partie qui suit ne comptera pas. */
export function marquerSansEnjeu(maintenant: number = Date.now()): void {
  ecrireJson(CLE, { le: maintenant } satisfies Marque);
}

/** Une partie commence : ce qui a été refusé avant ne la concerne pas. */
export function oublierSansEnjeu(): void {
  effacer(CLE);
}

/**
 * La partie qui se termine était-elle refusée ?
 *
 * Rend `false` sur tout ce qui n'est pas une marque fraîche et lisible : le
 * stockage n'est pas un format, n'importe qui peut y écrire, et une version
 * antérieure y a peut-être écrit autre chose. Dans le doute on ENREGISTRE
 * normalement — perdre le coût d'une partie qu'on voulait compter se voit et
 * se corrige à la main, l'inverse est une dette qu'on n'a pas méritée.
 */
export function estSansEnjeu(maintenant: number = Date.now()): boolean {
  const marque = lireJson<unknown>(CLE, null);
  if (!marque || typeof marque !== "object") return false;
  const le = (marque as Partial<Marque>).le;
  if (typeof le !== "number" || !Number.isFinite(le)) return false;
  // Une marque datée du futur est une horloge changée entre deux ouvertures,
  // pas un refus : on ne s'en sert pas.
  if (le > maintenant) return false;
  return maintenant - le <= PEREMPTION_MS;
}
