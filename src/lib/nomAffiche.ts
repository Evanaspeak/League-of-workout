/**
 * Le nom sous lequel on paraît devant les autres (réponse 128, « au choix »).
 *
 * La question portait sur une donnée personnelle : le pseudo Riot relie un
 * compte d'ici à une identité extérieure, que n'importe qui peut chercher
 * ailleurs — historiques de parties, classements, forums. Le pseudo interne,
 * lui, ne vaut que dans cette application.
 *
 * D'où le défaut : **le pseudo interne**. C'est la règle du plus fermé, la
 * même que pour le partage aux amis et le profil public — personne ne doit se
 * mettre à publier davantage parce qu'on a ajouté un réglage.
 */

export const NOMS = ["pseudo", "riot"] as const;
export type ChoixNom = (typeof NOMS)[number];

export const NOM_DEFAUT: ChoixNom = "pseudo";

export function toChoixNom(brut: unknown): ChoixNom {
  return NOMS.includes(brut as ChoixNom) ? (brut as ChoixNom) : NOM_DEFAUT;
}

/**
 * Ce qu'on montre aux autres.
 *
 * **Sans identifiant Riot rattaché, on retombe sur le pseudo.** Le choix n'a
 * alors rien à désigner, et ne rien afficher serait bien pire : une ligne de
 * classement sans nom, un profil sans titre. Le repli est plus fermé que ce
 * qui était demandé, ce qui est le bon sens pour un repli.
 *
 * Le pseudo Riot est rendu **sans son discriminant** : « Nom#EUW » se lit mal
 * dans une liste, et la partie après le dièse ne distingue rien entre gens qui
 * se connaissent. Elle reste en base, elle ne s'affiche pas.
 */
export function nomPublie(
  compte: { pseudo: string | null; riotId?: string | null; nomAffiche?: string | null },
): string {
  const pseudo = compte.pseudo ?? "";
  if (toChoixNom(compte.nomAffiche) !== "riot") return pseudo;
  const riot = (compte.riotId ?? "").trim();
  if (!riot) return pseudo;
  return riot.split("#")[0].trim() || pseudo;
}
