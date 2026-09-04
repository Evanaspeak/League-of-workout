/**
 * L'objectif calorique, et ce qu'on refuse d'en dire.
 *
 * Étape 05 du plan. Le propriétaire a dit oui à un pilier entier — un
 * calculateur, trois modes, un poids cible, un suivi — et deux de ses réponses
 * sont des REFUS qui comptent autant que le reste :
 *
 *  - **réponse 016 : aucune date d'objectif n'est promise.** La règle des
 *    7 700 kcal par kilo est fausse et abandonnée par la recherche : le corps
 *    ralentit sa dépense à mesure qu'il maigrit, et une date calculée là-dessus
 *    dérape de plusieurs semaines. Ce module n'expose donc RIEN qui ressemble
 *    à une échéance, et un test le vérifie plutôt que de compter sur la
 *    discipline.
 *  - **réponse 017 : un avertissement, pas un plancher bloquant.** Sous
 *    1 500 kcal (variante « h ») ou 1 200 (variante « f »), on le DIT et on
 *    affiche quand même. Refuser d'afficher ne protège personne : ça pousse à
 *    aller chercher le chiffre ailleurs, sans l'avertissement.
 *  - **réponse 018 : même chose sous 18,5 d'IMC.** On affiche, on avertit.
 *
 * ## Distinct de `calories.ts`, et il faut le dire
 *
 * `calories.ts` répond à « combien mes pompes ont-elles dépensé » — de
 * l'énergie SORTIE, déduite des points d'effort, sans rien demander à
 * personne. Ce module-ci répond à « combien devrais-je manger » — de l'énergie
 * ENTRÉE, qui exige un profil complet. Les deux parlent de kilocalories et ne
 * se mélangent jamais : le premier ne demande aucun consentement de plus, le
 * second en demande un.
 *
 * ## Pourquoi une VARIANTE de formule et pas un genre
 *
 * Mifflin-St Jeor a deux constantes selon le sexe biologique, et 166 kcal les
 * séparent. `User.genre` vient du formulaire bêta, en texte libre : s'en servir
 * casserait à la première personne qui écrit autre chose que les deux options
 * attendues, et le calcul retomberait en silence sur l'une des deux. Le champ
 * dédié dit ce qu'il fait — il choisit une formule — et sans lui on ne propose
 * aucun objectif.
 */

export type FormuleCalorique = "h" | "f";
export type ModeCalorique = "perte" | "maintien" | "prise";
export type NiveauActivite = "sedentaire" | "leger" | "modere" | "actif" | "intense";

/**
 * Les multiplicateurs d'activité, ceux de la littérature.
 *
 * Ils ne sont pas réglables : ce sont des constantes de la formule, pas des
 * préférences. Les rendre modifiables ferait croire qu'on peut les ajuster
 * pour obtenir le chiffre qu'on veut, ce qui est exactement l'inverse d'un
 * calculateur.
 */
export const MULTIPLICATEURS: Record<NiveauActivite, number> = {
  sedentaire: 1.2,
  leger: 1.375,
  modere: 1.55,
  actif: 1.725,
  intense: 1.9,
};

/**
 * L'écart appliqué au maintien, en proportion.
 *
 * Vingt pour cent en moins et dix en plus : des écarts modérés, tenables, et
 * qui ne demandent pas de promettre une date pour avoir du sens. Un déficit
 * plus agressif est précisément ce que l'avertissement de la réponse 017
 * existe pour signaler.
 */
export const ECARTS: Record<ModeCalorique, number> = {
  perte: -0.2,
  maintien: 0,
  prise: 0.1,
};

/** Les planchers de la réponse 017, en kcal par jour. Ils AVERTISSENT. */
export const PLANCHERS: Record<FormuleCalorique, number> = { h: 1500, f: 1200 };

export type Mesures = {
  formule: FormuleCalorique;
  /** Poids actuel, en kilos. */
  poids: number;
  /** Taille, en centimètres. */
  taille: number;
  age: number;
  activite: NiveauActivite;
};

/** Toutes les mesures sont-elles présentes et plausibles ? */
export function mesuresCompletes(m: Partial<Mesures> | null | undefined): m is Mesures {
  if (!m) return false;
  const nombres = [m.poids, m.taille, m.age];
  if (nombres.some((n) => typeof n !== "number" || !Number.isFinite(n) || n <= 0)) return false;
  if (m.formule !== "h" && m.formule !== "f") return false;
  return typeof m.activite === "string" && m.activite in MULTIPLICATEURS;
}

/**
 * Mifflin-St Jeor : le métabolisme de base, en kcal par jour.
 *
 * `10 × poids + 6,25 × taille − 5 × âge`, plus 5 pour la variante « h », moins
 * 161 pour « f ». C'est la formule de référence depuis 1990, et elle est plus
 * juste que Harris-Benedict sur les populations d'aujourd'hui.
 */
export function metabolismeBase(m: Mesures): number {
  const socle = 10 * m.poids + 6.25 * m.taille - 5 * m.age;
  return Math.round(socle + (m.formule === "h" ? 5 : -161));
}

/** La dépense totale : le métabolisme de base multiplié par l'activité. */
export function depenseTotale(m: Mesures): number {
  return Math.round(metabolismeBase(m) * MULTIPLICATEURS[m.activite]);
}

/** L'indice de masse corporelle, à une décimale. */
export function imc(poidsKg: number, tailleCm: number): number | null {
  if (!(poidsKg > 0) || !(tailleCm > 0)) return null;
  const m = tailleCm / 100;
  return Number((poidsKg / (m * m)).toFixed(1));
}

export type Objectif = {
  /** Ce que le corps dépense sans rien changer. */
  maintien: number;
  /** Ce qu'on vise, écart appliqué. */
  cible: number;
  mode: ModeCalorique;
  /** L'IMC actuel, pour l'avertissement de la réponse 018. */
  imc: number | null;
  /** Sous le plancher de la réponse 017 — on affiche quand même. */
  sousPlancher: boolean;
  /** Sous 18,5 d'IMC — on affiche quand même (réponse 018). */
  imcBas: boolean;
};

/**
 * L'objectif du jour, avec ses avertissements.
 *
 * Il ne rend AUCUNE durée, AUCUNE date, AUCUN « à ce rythme, dans X semaines ».
 * C'est la réponse 016, et c'est une décision de fond : une échéance calculée
 * sur une règle fausse est pire qu'aucune échéance, parce qu'on la croit.
 */
export function objectifCalorique(m: Mesures, mode: ModeCalorique): Objectif {
  const maintien = depenseTotale(m);
  const cible = Math.round(maintien * (1 + ECARTS[mode]));
  const indice = imc(m.poids, m.taille);
  return {
    maintien,
    cible,
    mode,
    imc: indice,
    sousPlancher: cible < PLANCHERS[m.formule],
    imcBas: indice !== null && indice < 18.5,
  };
}

/**
 * La masse grasse au mètre-ruban, formule US Navy (réponse 023, en option).
 *
 * Deux variantes, comme Mifflin-St Jeor. La variante « f » emploie le tour de
 * HANCHES, que la réponse 024 a explicitement accepté — sans lui la formule
 * n'existe pas, et l'estimer autrement reviendrait à inventer un chiffre.
 *
 * Rend `null` plutôt qu'un nombre absurde quand une mesure manque ou quand le
 * logarithme n'a pas de sens : un tour de cou supérieur au tour de taille
 * donne un logarithme d'un nombre négatif, et le résultat serait `NaN` — qui
 * traverse un affichage sans bruit.
 */
export function masseGrasse(
  formule: FormuleCalorique,
  tailleCm: number,
  tourTaille: number,
  tourCou: number,
  tourHanches?: number | null,
): number | null {
  const positifs = [tailleCm, tourTaille, tourCou];
  if (positifs.some((n) => typeof n !== "number" || !Number.isFinite(n) || n <= 0)) return null;

  if (formule === "h") {
    const base = tourTaille - tourCou;
    if (base <= 0) return null;
    const v = 495 / (1.0324 - 0.19077 * Math.log10(base) + 0.15456 * Math.log10(tailleCm)) - 450;
    return borner(v);
  }

  if (typeof tourHanches !== "number" || !Number.isFinite(tourHanches) || tourHanches <= 0) return null;
  const base = tourTaille + tourHanches - tourCou;
  if (base <= 0) return null;
  const v = 495 / (1.29579 - 0.35004 * Math.log10(base) + 0.22100 * Math.log10(tailleCm)) - 450;
  return borner(v);
}

/**
 * Un pourcentage hors de tout domaine physiologique n'est pas une mesure,
 * c'est une saisie fautive : on ne l'affiche pas plutôt que de la présenter
 * comme un résultat. Deux pour cent est le plancher des athlètes extrêmes,
 * soixante-quinze un plafond qu'aucun corps n'atteint.
 */
function borner(v: number): number | null {
  if (!Number.isFinite(v) || v < 2 || v > 75) return null;
  return Number(v.toFixed(1));
}
