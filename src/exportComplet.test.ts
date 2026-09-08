import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Tout ce qui est RATTACHÉ à un compte se retrouve dans son export.
 *
 * Le garde de `api/user/export/route.test.ts` vérifie que chaque bloc PRÉSENT
 * dans le fichier est annoncé par la phrase de l'écran, ou porte la raison
 * pour laquelle il ne l'est pas. C'est une bonne règle et elle a un angle mort
 * exact : **elle ne voit pas un modèle que l'export n'a jamais lu.** Un bloc
 * absent n'est pas un bloc mal annoncé, c'est un bloc invisible.
 *
 * C'est ainsi que les PESÉES sont restées hors de l'export depuis le jour où
 * elles existent — la donnée la plus sensible que l'application garde, de la
 * santé au sens de l'article 9, et saisie à la main, donc « fournie par la
 * personne » au sens le plus littéral de l'article 20. Rien ne le signalait :
 * le fichier était complet de tout ce qu'il contenait.
 *
 * Ce contrôle-ci part du SCHÉMA et non du fichier. Toute relation déclarée sur
 * `User` doit être lue par l'export, ou figurer ci-dessous avec sa raison.
 */

const RACINE = join(__dirname, "..");
const schema = readFileSync(join(RACINE, "prisma/schema.prisma"), "utf8");
const route = readFileSync(join(RACINE, "src/app/api/user/export/route.ts"), "utf8");

/**
 * Ce qu'un export ne rend pas, et pourquoi.
 *
 * Deux raisons seulement, et aucune n'est « on a jugé que ça n'intéresse
 * personne » — c'est précisément le raisonnement qui a laissé les pesées
 * dehors.
 */
const HORS_EXPORT: Record<string, string> = {
  /**
   * Ce qui NOMME quelqu'un d'autre.
   *
   * Une amitié sans l'ami n'est pas une donnée : l'autre bout de la relation
   * est l'identité d'une deuxième personne, qui n'a pas demandé à figurer dans
   * un fichier qu'on s'envoie par courriel. C'est la même frontière que celle
   * du profil d'un ami, où le filtre est en base plutôt qu'à l'affichage.
   */
  amitiesEnvoyees: "nomme quelqu'un d'autre",
  amitiesRecues: "nomme quelqu'un d'autre",
  groupes: "nomme quelqu'un d'autre",
  filleuls: "nomme quelqu'un d'autre",
  /**
   * Ce qui EST un laissez-passer.
   *
   * `Account` porte les jetons OAuth, `Session` les identifiants de session.
   * Les mettre dans un fichier qui circule par courriel serait une clé laissée
   * sur la table — c'est la raison qui tient déjà `jetonObs` hors de ce que le
   * compte publie.
   */
  accounts: "un jeton d'accès, pas une donnée personnelle",
  sessions: "un identifiant de session, pas une donnée personnelle",
};

/**
 * Les relations `Modele[]` déclarées sur `User`.
 *
 * Sa LIMITE est écrite plutôt que laissée à découvrir : le rapprochement se
 * fait sur le NOM DU DÉLÉGUÉ Prisma, donc deux relations vers le même modèle
 * sont indistinguables. `paiements` et `relaisRecus` pointent tous deux vers
 * `Paiement` : lire l'un satisferait le contrôle pour les deux. C'est
 * pourquoi les deux sont exportés plutôt qu'un seul dispensé — une dispense
 * que le garde ne saurait pas vérifier se relit comme une garantie.
 */
function relationsDuCompte(): { champ: string; modele: string }[] {
  const bloc = /model User \{([\s\S]*?)\n\}/.exec(schema);
  if (!bloc) throw new Error("modèle User introuvable — le garde ne garde plus rien");
  const rels: { champ: string; modele: string }[] = [];
  for (const m of bloc[1].matchAll(/^ {2}(\w+)\s+(\w+)\[\]/gm)) {
    // Les tableaux de types primitifs ne sont pas des relations : ce sont des
    // colonnes, déjà tenues par `compte.test.ts` et par la politique.
    if (/^(String|Int|Float|Boolean|DateTime|Json|Bytes|Decimal|BigInt)$/.test(m[2])) continue;
    rels.push({ champ: m[1], modele: m[2] });
  }
  return rels;
}

describe("l'export de données", () => {
  const relations = relationsDuCompte();

  it("lit chaque chose rattachée au compte, ou dit pourquoi il ne la lit pas", () => {
    // Sans témoin, un modèle renommé rendrait le contrôle vert sur zéro
    // relation — l'angle mort qu'il existe pour fermer.
    expect(relations.length).toBeGreaterThan(10);

    const oublies = relations.filter(({ champ, modele }) => {
      if (champ in HORS_EXPORT) return false;
      const delegue = modele[0].toLowerCase() + modele.slice(1);
      return !route.includes(`prisma.${delegue}.`);
    });
    expect(oublies).toEqual([]);
  });

  it("refuse une dispense qui ne désigne plus rien", () => {
    const champs = new Set(relations.map((r) => r.champ));
    expect(Object.keys(HORS_EXPORT).filter((c) => !champs.has(c))).toEqual([]);
  });

  /**
   * Le témoin du DÉCOUPAGE, distinct du précédent.
   *
   * Un motif qui rendrait le fichier ENTIER au lieu du seul bloc `User`
   * trouverait toutes les relations du schéma, donc bien plus que les siennes,
   * et le contrôle passerait pour la mauvaise raison : il chercherait des
   * modèles que l'export lit de toute façon. `Game` a ses propres relations,
   * et aucune n'appartient au compte.
   */
  it("ne lit que le bloc User", () => {
    expect(relations.some((r) => r.modele === "Game")).toBe(true);
    expect(relations.some((r) => r.modele === "User")).toBe(true);
    expect(relations.length).toBeLessThan(30);
  });
});
