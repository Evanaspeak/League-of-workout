import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { LANGUES } from "./langues";
import { aUneTraduction, translateApiError } from "./apiErrors";

/**
 * Tout message d'erreur qu'une route rend est-il traduit ?
 *
 * Les routes écrivent leurs messages en français, en dur. C'est un choix
 * assumé — la clé de traduction EST le message français, celui qui circule sur
 * le réseau. Le prix, c'est qu'un message ajouté sans sa traduction ne casse
 * rien, ne fait échouer aucun test, et sort en français chez quelqu'un qui n'a
 * jamais vu un écran français.
 *
 * Le recensement a trouvé **47 messages distincts sur 69** dans ce cas. Parmi eux
 * « Clé API Riot manquante (RIOT_API_KEY dans .env) », que tous ceux qui
 * essaient de relier leur compte Riot verraient tant que la clé de production
 * n'est pas arrivée : en français, et nommant un fichier qu'ils ne verront
 * jamais.
 */
const RACINE = join(__dirname, "..", "..", "app", "api");

/**
 * Messages qui ne paraissent sur aucun écran d'utilisateur, avec leur raison.
 *
 * Une exemption sans raison écrite est une traduction qu'on remet à plus tard
 * en s'autorisant à l'oublier.
 */
const SANS_ECRAN: Record<string, string> = {
  "Non autorisé":
    "Panneau d'administration et route d'initialisation : un seul compte les atteint, et c'est le nôtre.",
  "Missing id":
    "Administration. Le message est en anglais depuis toujours, et personne d'autre ne le lit.",
  "Signalement manquant": "Administration des signalements : seul le compte administrateur y accède.",
  "Statut inconnu": "Administration des signalements : seul le compte administrateur y accède.",
  "Impossible de supprimer son propre compte": "Administration des comptes : garde-fou lu par le seul administrateur.",
  "Cette configuration est commune à tous les comptes":
    "Le panneau avancé des réglages ne s'affiche que pour un administrateur ; la route refuse les autres avant même d'arriver ici.",
  "Erreur base de données : la table SystemConfig n'existe pas encore.":
    "Administration, et c'est un message de diagnostic : il nomme la table exprès.",
  "Initialisation non configurée":
    "Route d'amorçage protégée par un secret partagé, appelée à la main au premier démarrage.",
  "Lien inconnu":
    "Source de diffusion lue par un logiciel de streaming. Elle n'a pas de lecteur humain, et l'adresse est le laissez-passer.",
};

/** Les messages `error: "…"` que rendent les routes, fichier par fichier. */
function messagesDesRoutes(): Map<string, Set<string>> {
  const trouves = new Map<string, Set<string>>();
  const motif = /error:\s*"((?:[^"\\]|\\.)+)"/g;

  const parcourir = (dossier: string) => {
    for (const entree of readdirSync(dossier)) {
      const chemin = join(dossier, entree);
      if (statSync(chemin).isDirectory()) { parcourir(chemin); continue; }
      if (!entree.endsWith(".ts") || entree.endsWith(".test.ts")) continue;
      const source = readFileSync(chemin, "utf8");
      for (const m of source.matchAll(motif)) {
        const message = m[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        if (!trouves.has(message)) trouves.set(message, new Set());
        trouves.get(message)!.add(chemin.slice(chemin.indexOf("api/")));
      }
    }
  };
  parcourir(RACINE);
  return trouves;
}

describe("les messages d'erreur des routes", () => {
  test("le recensement trouve bien les routes et leurs messages", () => {
    // Sans ce contrôle, un motif qui cesse de correspondre rend une liste vide
    // et tout le reste passe en ne regardant rien.
    const trouves = messagesDesRoutes();
    expect(trouves.size).toBeGreaterThan(60);
    expect([...trouves.keys()]).toContain("Non authentifié");
  });

  test("chacun est traduit, ou exempté avec sa raison", () => {
    const orphelins: string[] = [];
    for (const [message, fichiers] of messagesDesRoutes()) {
      if (message in SANS_ECRAN) continue;
      // La question se pose sur la présence dans la table, pas sur le
      // résultat : « Unauthorized » s'écrit pareil en anglais, et le déduire
      // du résultat le rangerait parmi les oubliés.
      if (!aUneTraduction(message)) {
        orphelins.push(`${message}  (${[...fichiers].join(", ")})`);
      }
    }
    expect(orphelins).toEqual([]);
  });

  test("chaque exemption nomme un message qui existe vraiment", () => {
    // Une exemption périmée cache le jour où le message revient, ailleurs.
    const rendus = messagesDesRoutes();
    for (const message of Object.keys(SANS_ECRAN)) {
      // Le message est joint à l'attente : sans lui, l'échec ne dit pas
      // laquelle des exemptions a vieilli.
      expect({ message, rendu: rendus.has(message) }).toEqual({ message, rendu: true });
    }
  });

  test("chaque exemption dit pourquoi, en une phrase au moins", () => {
    for (const [message, raison] of Object.entries(SANS_ECRAN)) {
      expect({ message, assezLong: raison.length > 30 }).toEqual({ message, assezLong: true });
    }
  });

  test("les traductions couvrent les six langues, sans trou", () => {
    /**
     * On n'exige PAS que chaque langue diffère du français : « Unauthorized »
     * s'écrit pareil en anglais, et une règle qui l'interdirait forcerait à
     * inventer une différence. Ce qu'on exige, c'est qu'aucune langue ne rende
     * du vide — le repli sur l'anglais compris.
     */
    const vides: string[] = [];
    for (const [message] of messagesDesRoutes()) {
      if (message in SANS_ECRAN) continue;
      for (const langue of LANGUES) {
        if (translateApiError(message, langue).trim().length === 0) {
          vides.push(`${message} (${langue})`);
        }
      }
    }
    expect(vides).toEqual([]);
  });
});
