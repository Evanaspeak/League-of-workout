/**
 * Les séances faites sans réseau, gardées jusqu'à ce qu'elles passent.
 *
 * La dette se paie souvent là où le réseau n'est pas : une salle en sous-sol,
 * un train, une chambre au fond d'un appartement. Jusqu'ici l'échec était
 * avalé en silence — `catch {}` autour de l'envoi, la fenêtre se refermait, et
 * l'effort était perdu. C'est la pire façon de se tromper : celui qui vient de
 * faire ses pompes voit sa dette intacte et conclut que l'application ne
 * marche pas.
 *
 * Ce qui est mis de côté ici, c'est le PAIEMENT, pas la partie. Une partie a
 * besoin du barème du serveur pour être chiffrée ; un paiement, lui, dit une
 * chose complète et vérifiable : « j'ai fait tant de secondes d'effort, tel
 * jour ». C'est aussi ce que la question demandait — enregistrer sa séance.
 *
 * Chaque entrée porte un jeton, et le serveur refuse un jeton déjà vu. Sans
 * lui, un renvoi paierait deux fois : la file réessaie tant qu'elle n'a pas de
 * réponse, et une réponse perdue en chemin est indiscernable d'une requête
 * jamais arrivée.
 */
import { ecrire, lire } from "./stockage";

const CLE = "low_file_paiements";

/** Au-delà, on garde les plus récentes : une file sans fin n'est plus une file. */
const MAX = 50;

export type PaiementEnAttente = {
  jeton: string;
  jour: string;
  /** Secondes d'effort réellement faites, ou `tout` pour une dette soldée. */
  secondes?: number;
  tout?: boolean;
  /** Quand la séance a été faite, pour pouvoir la dire à qui la relit. */
  quand: number;
};

/** Prévenus à chaque changement de la file, pour que l'affichage suive. */
const abonnes = new Set<() => void>();

export function abonnerFile(onChange: () => void) {
  abonnes.add(onChange);
  return () => { abonnes.delete(onChange); };
}

function prevenir() {
  for (const f of abonnes) f();
}

/**
 * Le contenu de la file.
 *
 * Tout ce qui touche au stockage local est enveloppé : un navigateur en
 * navigation privée, ou réglé pour refuser les sites, lève à la lecture comme
 * à l'écriture. Une séance perdue est regrettable ; une page blanche parce que
 * le stockage a dit non l'est davantage.
 */
export function lireFile(): PaiementEnAttente[] {
  try {
    const brut = lire(CLE);
    if (!brut) return [];
    const lu = JSON.parse(brut);
    return Array.isArray(lu) ? lu.filter((e) => e && typeof e.jeton === "string") : [];
  } catch {
    return [];
  }
}

function ecrireFile(file: PaiementEnAttente[]) {
  try {
    ecrire(CLE, JSON.stringify(file.slice(-MAX)));
  } catch {
    /* stockage refusé : la file ne survivra pas au rechargement, tant pis */
  }
  prevenir();
}

/** Un identifiant que le serveur pourra reconnaître au renvoi. */
function nouveauJeton(): string {
  try {
    return crypto.randomUUID();
  } catch {
    // `randomUUID` n'existe qu'en contexte sécurisé. Le jeton n'a pas besoin
    // d'être imprévisible — il n'ouvre rien — seulement d'être unique.
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** Met une séance de côté. Rend son jeton. */
export function enfiler(entree: Omit<PaiementEnAttente, "jeton" | "quand">): string {
  const jeton = nouveauJeton();
  ecrireFile([...lireFile(), { ...entree, jeton, quand: Date.now() }]);
  return jeton;
}

function retirer(jeton: string) {
  ecrireFile(lireFile().filter((e) => e.jeton !== jeton));
}

/**
 * Envoie ce qui attend, une entrée à la fois.
 *
 * En série et non en parallèle : le serveur calcule chaque paiement sur la
 * dette du moment, et deux envois simultanés liraient la même valeur. Le
 * premier échec réseau arrête tout — inutile de brûler la file entière quand
 * le réseau est encore coupé.
 *
 * @returns le nombre d'entrées effectivement passées.
 */
export async function viderFile(): Promise<number> {
  let passees = 0;
  for (const entree of lireFile()) {
    let res: Response;
    try {
      res = await fetch("/api/dette", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jeton: entree.jeton,
          jour: entree.jour,
          ...(entree.tout ? { tout: true } : { secondes: entree.secondes ?? 0 }),
        }),
      });
    } catch {
      // Toujours hors réseau : on garde tout et on réessaiera.
      break;
    }
    if (res.ok) {
      retirer(entree.jeton);
      passees++;
      continue;
    }
    // 401 : la session a expiré. La séance reste, elle repartira une fois
    // reconnecté — la jeter serait perdre l'effort pour de bon.
    if (res.status === 401) break;
    // 4xx : le serveur ne veut pas de cette entrée et n'en voudra jamais. La
    // garder ferait bloquer toute la file derrière elle.
    if (res.status >= 400 && res.status < 500) {
      retirer(entree.jeton);
      continue;
    }
    // 5xx : c'est peut-être passager.
    break;
  }
  if (passees > 0) {
    // La pastille de dette et le titre de l'onglet se rafraîchissent.
    window.dispatchEvent(new Event("wow-dette-changee"));
  }
  return passees;
}
