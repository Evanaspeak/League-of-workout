/**
 * Le défi du jour (ligne 138, réponse « Oui »).
 *
 * Un objectif qui change chaque jour et qui vaut vingt-quatre heures. Ce qu'il
 * apporte n'est pas une récompense — le produit n'a ni monnaie ni objet, et en
 * inventer une reviendrait à offrir des points d'effort que personne n'a
 * gagnés, ce qui fausserait la dette, le classement et les paliers d'un coup.
 * Ce qu'il apporte est une RAISON D'OUVRIR, et c'est déjà ce qu'on cherche.
 *
 * **Le même pour tout le monde.** La réponse dit « différent chaque jour »,
 * elle ne dit pas « différent par personne ». Un défi commun se raconte — « t'as
 * fait celui d'aujourd'hui ? » — et un défi personnel ne se raconte à personne.
 * Faute d'une raison de faire autrement, c'est le jour qui décide, et lui seul.
 *
 * **Chaque défi demande un GESTE.** Un défi qu'on remplit sans rien faire — «
 * solder ta dette » quand on ne doit rien — se lit comme une flatterie, et une
 * flatterie quotidienne finit par ne plus rien vouloir dire.
 */

export type Defi = {
  cle: string;
  /** Ce qu'il faut atteindre dans la journée. */
  cible: number;
  /** Sur quoi il se mesure. */
  mesure: "parties" | "victoires" | "jeux" | "points" | "seances";
};

/**
 * Six défis, trois qui parlent de jouer et trois de payer.
 *
 * L'équilibre n'est pas décoratif : la réponse 131 demande « en volume ET en
 * nombre de parties », et un défi qui ne parlerait que de jouer récompenserait
 * la soirée sans jamais parler de ce qu'elle coûte.
 */
export const DEFIS: Defi[] = [
  { cle: "parties3", cible: 3, mesure: "parties" },
  { cle: "paye100", cible: 100, mesure: "points" },
  { cle: "victoires2", cible: 2, mesure: "victoires" },
  { cle: "seances1", cible: 1, mesure: "seances" },
  { cle: "jeux2", cible: 2, mesure: "jeux" },
  { cle: "paye300", cible: 300, mesure: "points" },
];

/**
 * L'écart entre le premier et le dernier d'un bloc.
 *
 * Il doit être différent de 0 (sinon premier et dernier se confondent) et de 1
 * (sinon le dernier d'un bloc vaut le premier du suivant, ce qu'on veut
 * précisément éviter). Trois convient pour six défis, et un test le vérifie
 * plutôt que de le laisser à la relecture.
 */
export const DECALAGE_FIN = 3;

/** Le premier jour compté. Il ne sert qu'à numéroter, pas à dater. */
export const EPOQUE = "2026-01-01";
const JOUR_MS = 24 * 60 * 60 * 1000;

/** Le rang du jour depuis l'époque. Négatif avant elle, ce qui est permis. */
export function rangDuJour(jour: string): number {
  const t = Date.parse(`${jour}T00:00:00.000Z`);
  if (!Number.isFinite(t)) return 0;
  return Math.floor((t - Date.parse(`${EPOQUE}T00:00:00.000Z`)) / JOUR_MS);
}

/** Générateur déterministe, pour que le mélange dépende du seul numéro de bloc. */
function suite(graine: number): () => number {
  let x = (graine * 2654435761) >>> 0;
  return () => {
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >>> 17)) >>> 0;
    x = (x ^ (x << 5)) >>> 0;
    return x / 4294967296;
  };
}

/** Mélange de Fisher-Yates, semé par le numéro de bloc. */
function melanger<T>(liste: T[], graine: number): T[] {
  const tirage = suite(graine);
  const copie = liste.slice();
  for (let i = copie.length - 1; i > 0; i -= 1) {
    const j = Math.floor(tirage() * (i + 1));
    [copie[i], copie[j]] = [copie[j], copie[i]];
  }
  return copie;
}

/**
 * Le défi d'un jour donné.
 *
 * **Ce n'est pas un tirage indépendant, et c'est délibéré.** Tirer au hasard
 * chaque jour ferait tomber deux fois le même défi une fois sur six, ce qui
 * contredirait la seule chose que la ligne promette : « différent chaque
 * jour ». Les six défis sont donc parcourus par blocs de six — chacun paraît
 * une fois par bloc, et jamais deux jours de suite.
 *
 * **La couture entre deux blocs est traitée par CONSTRUCTION, pas par
 * rattrapage.** Le premier jet mélangeait le bloc entier puis le faisait
 * tourner d'un cran quand son premier valait le dernier du bloc d'avant. Ça ne
 * marche pas : le bloc d'avant a peut-être tourné lui aussi, donc son dernier
 * n'est pas celui du mélange brut, et la question remonte de proche en proche
 * sans jamais se refermer. Le contrôle sur une année entière a rendu treize
 * répétitions.
 *
 * Le premier et le dernier de chaque bloc sont donc FIXÉS par une rotation
 * simple — le premier du bloc b est `DEFIS[b % n]`, le dernier
 * `DEFIS[(b + 3) % n]` — et seuls les quatre du milieu sont mélangés. La
 * couture ne peut plus se produire : le premier du bloc suivant vaut
 * `DEFIS[(b + 1) % n]`, qui ne peut égaler `DEFIS[(b + 3) % n]` que si 3 ≡ 1
 * modulo n, c'est-à-dire pour n = 2. Un test tient cette condition, parce
 * qu'ajouter un septième défi la remettrait en jeu.
 */
export function defiDuJour(jour: string): Defi {
  const n = DEFIS.length;
  const d = rangDuJour(jour);
  const bloc = Math.floor(d / n);
  const position = ((d % n) + n) % n;

  const iPremier = ((bloc % n) + n) % n;
  const iDernier = (((bloc + DECALAGE_FIN) % n) + n) % n;
  const premier = DEFIS[iPremier];
  const dernier = DEFIS[iDernier];
  const milieu = melanger(
    DEFIS.filter((_, i) => i !== iPremier && i !== iDernier),
    bloc,
  );
  return [premier, ...milieu, dernier][position];
}

/** Ce qu'on a fait aujourd'hui, et rien d'autre. */
export type SourceDefi = {
  partiesDuJour: number;
  victoiresDuJour: number;
  jeuxDuJour: number;
  pointsPayesDuJour: number;
  seancesDuJour: number;
};

export type AvancementDefi = {
  cle: string;
  cible: number;
  /** Où l'on en est, borné à la cible. */
  ou: number;
  fait: boolean;
};

export function avancementDefi(defi: Defi, source: SourceDefi): AvancementDefi {
  const brut = {
    parties: source.partiesDuJour,
    victoires: source.victoiresDuJour,
    jeux: source.jeuxDuJour,
    points: source.pointsPayesDuJour,
    seances: source.seancesDuJour,
  }[defi.mesure];
  const valeur = Number.isFinite(brut) ? Math.max(0, Math.floor(brut)) : 0;
  return {
    cle: defi.cle,
    cible: defi.cible,
    ou: Math.min(defi.cible, valeur),
    fait: valeur >= defi.cible,
  };
}
