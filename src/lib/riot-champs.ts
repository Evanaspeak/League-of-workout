/**
 * Ce qu'on accepte d'un joueur avant de parler à Riot en son nom.
 *
 * Les appels sortants portent la clé d'API du serveur. Un identifiant qui part
 * tel quel dans l'URL laisse donc choisir la requête envoyée sous cette clé :
 * `PU/ids?api_key=x#` déplaçait le suffixe codé en dur dans le fragment, ce qui
 * rendait le chemin ET la requête entièrement libres. L'hôte, lui, restait
 * verrouillé par la table ci-dessous — c'est ce qui a évité le pire.
 *
 * Deux verrous plutôt qu'un : on valide à l'écriture (ici), et on encode à
 * l'usage (`encodeURIComponent` sur chaque segment). L'un sans l'autre finit
 * toujours par être oublié quelque part.
 */

/**
 * Plateformes Riot connues, et le routage régional de chacune.
 *
 * Prototype nul volontaire : sur un objet ordinaire, `table["toString"]` rend la
 * méthode héritée — donc une valeur vraie — et le repli `?? "europe"` ne se
 * déclenche jamais. Le nom d'hôte se construisait alors à partir du code source
 * d'une fonction native.
 */
export const ROUTAGE_RIOT: Record<string, string> = Object.assign(Object.create(null), {
  EUW1: "europe", EUN1: "europe", TR1: "europe", RU: "europe",
  NA1: "americas", BR1: "americas", LA1: "americas", LA2: "americas",
  KR: "asia", JP1: "asia",
  OC1: "sea", PH2: "sea", SG2: "sea", TH2: "sea", TW2: "sea", VN2: "sea",
});

export const REGIONS_RIOT: string[] = Object.keys(ROUTAGE_RIOT);

/** Routage d'une plateforme. Repli sur l'Europe, comme avant. */
export function routageDe(region: unknown): string {
  if (typeof region !== "string") return "europe";
  const routage = Object.hasOwn(ROUTAGE_RIOT, region) ? ROUTAGE_RIOT[region] : undefined;
  return typeof routage === "string" ? routage : "europe";
}

/**
 * Un PUUID Riot fait 78 caractères en base64 URL. On reste un peu large sur la
 * longueur — le format n'est pas contractuel — mais strict sur l'alphabet :
 * ni barre oblique, ni point, ni dièse, ni point d'interrogation.
 */
export function validerPuuid(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const puuid = brut.trim();
  return /^[A-Za-z0-9_-]{1,128}$/.test(puuid) ? puuid : null;
}

/**
 * Un Riot ID s'écrit « pseudo#tag ». Le client League y glisse des caractères
 * de direction invisibles (U+2066, U+2069…) qu'on retire avant de juger.
 */
export function nettoyerRiotId(brut: unknown): string {
  if (typeof brut !== "string") return "";
  return Array.from(brut)
    .filter((c) => {
      const code = c.codePointAt(0) ?? 0;
      return code >= 0x20 && !(code >= 0x200b && code <= 0x206f) && code !== 0xfeff;
    })
    .join("")
    .trim();
}

/** Nettoie puis valide un Riot ID complet. Rend `null` s'il ne tient pas. */
export function validerRiotId(brut: unknown): string | null {
  const riotId = nettoyerRiotId(brut);
  if (riotId.length < 3 || riotId.length > 40) return null;
  const [gameName, tagLine, ...reste] = riotId.split("#");
  if (reste.length > 0) return null;
  if (!gameName || gameName.length > 32) return null;
  if (!tagLine || !/^[A-Za-z0-9]{2,8}$/.test(tagLine)) return null;
  return riotId;
}
