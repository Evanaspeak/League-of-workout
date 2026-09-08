/**
 * Exercices et conversion d'effort.
 *
 * Toute la base de calcul du scoring reste exprimée en POINTS D'EFFORT, où
 * 1 point = 1 pompe (c'est l'historique du projet : le champ Prisma
 * `Game.pompesCalculees` stocke ces points). Chaque exercice définit combien
 * d'unités (répétitions ou secondes) coûte 1 point, ce qui permet de changer
 * d'exercice sans toucher au moteur de scoring.
 *
 * Le gainage n'est PAS un exercice ici : il sert uniquement de test de
 * calibrage pour déterminer le niveau (1 à 5) de l'utilisateur.
 */

import { dureeLocalisee } from "./i18n/duree";
import { uniteLocalisee } from "./i18n/unite";

export type ExerciceId =
  | "pompes" | "squats" | "boxe"
  | "planche" | "tractions" | "course"
  // Les deux exercices ADAPTÉS (réponse 260). La 259 demandait si quelqu'un
  // qui ne peut pas faire de pompes peut se servir de l'application
  // aujourd'hui, et la réponse était « mal » : les six premiers exercices
  // supposent tous de pouvoir descendre au sol ou de courir.
  | "pompesMurales" | "marche"
  /**
   * Réponse 078 : « Les deux séparés ».
   *
   * La question partait d'un fait — un sac de frappe est du matériel que peu
   * de gens ont — et le catalogue disait « sac ou shadow, au choix » sous une
   * seule entrée marquée SANS matériel. Les deux moitiés étaient donc fausses
   * l'une pour l'autre : celui qui n'a pas de sac lisait un exercice qui a
   * l'air à sa portée, et le module de calories, lui, chiffrait déjà « la
   * boxe au SAC ». La séparation remet les deux d'accord.
   */
  | "shadow"
  /**
   * L'élargissement du catalogue (réponses 061, 065 et 067).
   *
   * « Liste fermée plus grande », « le plus varié possible, diviser en sous
   * catégories », et des groupes musculaires « pour que la rotation évite de
   * faire trois jours de pectoraux d'affilée ». La liste reste FERMÉE — c'est
   * ce qui permet de chiffrer une partie — et elle se range par groupe.
   *
   * Ce qui a décidé de CES exercices-là n'est pas le goût, c'est le
   * déséquilibre : à neuf entrées, le bas du corps et le tronc en avaient UNE
   * chacun contre trois au haut du corps et quatre au cardio. Une
   * sous-catégorie à une entrée n'est pas une sous-catégorie, et une rotation
   * qui doit éviter trois jours de pectoraux d'affilée n'a rien vers quoi
   * tourner.
   */
  | "fentes" | "chaise"
  | "abdos" | "gainageLateral"
  | "burpees" | "corde" | "dips";

export type UniteExercice = "reps" | "temps" | "distance";

/**
 * Groupe travaillé, pour qu'une rotation évite trois jours de pectoraux
 * d'affilée. Le champ existe avant l'écran qui s'en servira : le renseigner
 * plus tard supposerait de rouvrir six définitions et d'en oublier une.
 */
export type GroupeMusculaire = "haut" | "bas" | "tronc" | "cardio";

/**
 * L'ordre des sous-catégories à l'écran (réponses 061 et 067).
 *
 * Il va du plus familier au plus spécialisé — le haut du corps est ce que tout
 * le monde connaît, le cardio ce qu'on choisit — et il ne suit donc pas
 * l'ordre du catalogue, qui est celui de l'histoire du produit.
 *
 * La table est un `Record` et non un tableau, et c'est ce qui la rend
 * EXHAUSTIVE : un groupe ajouté au type sans être placé ici ne compile pas.
 * Écrite en tableau, elle aurait laissé une sous-catégorie entière disparaître
 * de l'écran sans que rien ne le dise.
 */
const RANG_GROUPE: Record<GroupeMusculaire, number> = { haut: 1, bas: 2, tronc: 3, cardio: 4 };

export const GROUPES: GroupeMusculaire[] =
  (Object.keys(RANG_GROUPE) as GroupeMusculaire[]).sort((a, b) => RANG_GROUPE[a] - RANG_GROUPE[b]);

export type ExerciceDef = {
  id: ExerciceId;
  /** Unités par point d'effort (1 point = 1 pompe). */
  ratio: number;
  unite: UniteExercice;
  /** Pas d'arrondi de la quantité affichée (évite « 2 min 51 »). */
  pas: number;
  /**
   * Secondes de travail pour une répétition, micro-repos compris. Sert à
   * exprimer une dette en temps d'effort, seule unité commune à tous les
   * exercices. Absent pour un exercice déjà compté en temps : son `ratio`
   * donne directement des secondes.
   */
  secondesParRep?: number;
  /** Ce qu'il travaille. */
  groupe: GroupeMusculaire;
  /**
   * Demande-t-il du matériel ?
   *
   * Les tractions supposent une barre, et la corde une corde. Le dire évite
   * qu'on choisisse un exercice qu'on ne pourra pas faire, et découvre le
   * problème une fois la dette due.
   */
  materiel: boolean;
};

/**
 * Ratios livrés avec l'application. Ils servent de valeur de repli quand
 * l'administration n'en a défini aucun, et de borne de retour au défaut.
 */
export const RATIOS_DEFAUT: Record<ExerciceId, number> = {
  pompes: 1,
  squats: 1.5,
  boxe: 7,
  // Le gainage tenu coûte moins qu'un round de sac à la seconde : cinq
  // secondes de planche valent un point.
  planche: 5,
  // Une traction vaut cinq points. Le premier réglage en donnait quarante pour
  // cent points : c'est le contraire de ce qu'on veut, puisque l'exercice est
  // le plus exigeant du lot. Vingt tractions pour cent points, soit à peu près
  // le même temps que cent pompes une fois les repos comptés.
  tractions: 0.2,
  // Vingt mètres par point. Cent points font deux kilomètres, soit à peu près
  // le temps que demandent cent pompes une fois les repos comptés.
  course: 0.02,
  // Deux pompes murales pour un point. Le mouvement est le même, la charge
  // ne l'est pas : debout face à un mur, on pousse à peu près la moitié de
  // ce qu'on pousse au sol. Le rapport se choisit sur le TEMPS, comme celui
  // de la course et des tractions : deux pompes murales de trois secondes
  // font les six secondes d'une pompe au sol.
  pompesMurales: 2,
  // Dix mètres par point : cent points font un kilomètre, soit une douzaine
  // de minutes de marche. C'est un peu PLUS de temps que cent pompes, ce qui
  // est le bon sens de l'écart pour un exercice moins intense — sans quoi
  // marcher deviendrait la façon d'effacer sa dette à bon compte.
  marche: 0.01,
  // Sept secondes et demie pour un point, contre sept au sac. L'écart est
  // petit et il est dans le bon sens : sans impact ni résistance, une seconde
  // de shadow achète un peu moins d'effort qu'une seconde de sac. Le garder
  // petit est ce qui laisse le choix LIBRE — c'est le principe que
  // `tempsParPoint.test.ts` tient pour tout le catalogue.
  shadow: 7.5,
  // ── Bas du corps ──
  // Une fente et quart pour un point : le mouvement est unilatéral, donc plus
  // lent qu'un squat, et il en faut un peu plus pour le même temps.
  fentes: 1.2,
  // Chaise contre un mur, en secondes. Sept par point : une position tenue se
  // supporte plus longtemps qu'une planche, dont les cinq secondes sont le
  // repère isométrique du catalogue.
  chaise: 7,
  // ── Tronc ──
  // Deux abdos pour un point : le mouvement est court et la charge légère.
  abdos: 2,
  // Gainage latéral, en secondes. Le même repère que la planche : c'est la
  // même position tenue, sur le côté.
  gainageLateral: 5,
  // ── Cardio ──
  // Sept dixièmes de burpee pour un point, soit un peu plus d'un point par
  // burpee : c'est l'exercice le plus complet du catalogue et le plus lent.
  burpees: 0.7,
  // Corde à sauter, en secondes. Six par point : la cadence ne laisse pas de
  // temps mort, donc une seconde y achète un peu plus qu'au sac.
  corde: 6,
  // ── Haut du corps ──
  // Un dip vaut deux points. Entre la pompe (un point) et la traction (cinq) :
  // on pousse plus qu'au sol et moins qu'on ne tire à la barre.
  dips: 0.5,
};

export const EXERCICES: Record<ExerciceId, ExerciceDef> = {
  // Référence historique : 1 pompe = 1 point d'effort.
  pompes: { id: "pompes", ratio: RATIOS_DEFAUT.pompes, unite: "reps", pas: 1, secondesParRep: 6, groupe: "haut", materiel: false },
  // Les jambes encaissent plus de répétitions que le haut du corps.
  squats: { id: "squats", ratio: RATIOS_DEFAUT.squats, unite: "reps", pas: 1, secondesParRep: 5, groupe: "bas", materiel: false },
  // Boxe au SAC : cardio soutenu, compté en temps de travail effectif. Le sac
  // est du matériel, et le dire est tout l'objet de la réponse 078 — l'entrée
  // annonçait le contraire tandis que le module de calories chiffrait déjà
  // « la boxe au sac ».
  boxe: { id: "boxe", ratio: RATIOS_DEFAUT.boxe, unite: "temps", pas: 5, groupe: "cardio", materiel: true },
  // Gainage tenu, compté en secondes. Le même mouvement sert de test de force
  // pour les comptes qui n'ont pas encore fait le test de pompes.
  planche: { id: "planche", ratio: RATIOS_DEFAUT.planche, unite: "temps", pas: 5, groupe: "tronc", materiel: false },
  // Barre nécessaire, et c'est dit : découvrir qu'on ne peut pas faire son
  // exercice une fois la dette due est la pire façon de l'apprendre.
  tractions: { id: "tractions", ratio: RATIOS_DEFAUT.tractions, unite: "reps", pas: 1, secondesParRep: 20, groupe: "haut", materiel: true },
  // Course, en kilomètres. Le pas de cent mètres évite d'afficher « 1,37 km ».
  course: { id: "course", ratio: RATIOS_DEFAUT.course, unite: "distance", pas: 0.1, secondesParRep: 360, groupe: "cardio", materiel: false },
  // Pompes murales : debout, mains au mur. Aucun passage au sol, aucune
  // charge sur les poignets. C'est l'exercice qui manquait pour que la
  // réponse à la 259 cesse d'être « mal ».
  pompesMurales: { id: "pompesMurales", ratio: RATIOS_DEFAUT.pompesMurales, unite: "reps", pas: 1, secondesParRep: 3, groupe: "haut", materiel: false },
  // Marche, en kilomètres. Douze minutes par kilomètre, soit cinq km/h : le
  // pas de quelqu'un qui marche pour de bon, pas celui d'une promenade.
  marche: { id: "marche", ratio: RATIOS_DEFAUT.marche, unite: "distance", pas: 0.1, secondesParRep: 720, groupe: "cardio", materiel: false },
  // Shadow boxing : les mêmes enchaînements, dans le vide. Rien à posséder,
  // rien à accrocher, et ça se fait dans deux mètres carrés.
  shadow: { id: "shadow", ratio: RATIOS_DEFAUT.shadow, unite: "temps", pas: 5, groupe: "cardio", materiel: false },
  // Fentes : le bas du corps sans matériel, en alternant les jambes. Une
  // répétition compte une jambe — c'est ainsi qu'on les compte en salle, et
  // compter les deux ferait un chiffre qui ne ressemble à rien.
  fentes: { id: "fentes", ratio: RATIOS_DEFAUT.fentes, unite: "reps", pas: 1, secondesParRep: 6, groupe: "bas", materiel: false },
  // Chaise : dos au mur, cuisses à l'horizontale. Rien à posséder, et c'est
  // le pendant de la planche pour les jambes.
  chaise: { id: "chaise", ratio: RATIOS_DEFAUT.chaise, unite: "temps", pas: 5, groupe: "bas", materiel: false },
  // Abdos : le mouvement court du tronc, celui que tout le monde sait faire.
  abdos: { id: "abdos", ratio: RATIOS_DEFAUT.abdos, unite: "reps", pas: 1, secondesParRep: 3, groupe: "tronc", materiel: false },
  // Gainage latéral : la même position tenue que la planche, sur le côté. Il
  // travaille les obliques, que la planche de face ne prend presque pas.
  gainageLateral: { id: "gainageLateral", ratio: RATIOS_DEFAUT.gainageLateral, unite: "temps", pas: 5, groupe: "tronc", materiel: false },
  // Burpees : l'exercice le plus complet du catalogue, et le plus lent.
  burpees: { id: "burpees", ratio: RATIOS_DEFAUT.burpees, unite: "reps", pas: 1, secondesParRep: 10, groupe: "cardio", materiel: false },
  // Corde à sauter : une corde suffit, et c'est du matériel — le dire est la
  // même règle que pour le sac et la barre de traction.
  corde: { id: "corde", ratio: RATIOS_DEFAUT.corde, unite: "temps", pas: 5, groupe: "cardio", materiel: true },
  // Dips : deux chaises ou des barres parallèles. Du matériel, donc, même
  // improvisé.
  dips: { id: "dips", ratio: RATIOS_DEFAUT.dips, unite: "reps", pas: 1, secondesParRep: 12, groupe: "haut", materiel: true },
};

export const EXERCICE_IDS = Object.keys(EXERCICES) as ExerciceId[];

/**
 * Le catalogue rangé par sous-catégorie, dans l'ordre d'affichage.
 *
 * À seize exercices, une liste plate ne se lit plus — et une rotation censée
 * éviter trois jours de pectoraux d'affilée n'a aucun moyen de se voir. Le
 * rangement se fait ici plutôt que dans l'écran : trois composants montent ce
 * sélecteur, et une règle écrite trois fois finit par n'être vraie qu'à deux
 * endroits.
 */
export function exercicesParGroupe(): { groupe: GroupeMusculaire; ids: ExerciceId[] }[] {
  return GROUPES.map((groupe) => ({
    groupe,
    ids: EXERCICE_IDS.filter((id) => EXERCICES[id].groupe === groupe),
  }));
}

/**
 * Exercices dont le ratio se règle depuis l'administration.
 *
 * Les pompes n'en sont pas, et c'est volontaire : le point d'effort EST la
 * pompe. `Game.pompesCalculees` stocke des points depuis le premier jour, et
 * changer ce ratio-là relirait tout l'historique dans une autre unité sans
 * qu'aucun écran ne le dise. Régler les deux autres par rapport aux pompes
 * donne exactement le même pouvoir de réglage, en gardant une référence fixe.
 *
 * La liste se DÉDUIT du catalogue au lieu d'être écrite à la main. Elle valait
 * « tout sauf les pompes » — c'est-à-dire la règle ci-dessus, écrite une
 * seconde fois — et un test l'exigeait déjà des deux côtés. Un exercice ajouté
 * demandait donc de venir ici, et de l'oublier rendait son ratio non
 * réglable : le genre d'écart qui ne se voit qu'à l'usage, sur le panneau
 * d'administration où personne ne compte les lignes.
 */
export const EXERCICES_REGLABLES: ExerciceId[] = EXERCICE_IDS.filter((id) => id !== "pompes");

/**
 * Bornes acceptées pour chaque ratio. Elles ne sont pas décoratives : un
 * ratio nul ferait disparaître la dette, un ratio négatif la rendrait
 * négative, et une valeur démesurée transformerait une défaite en punition
 * intenable. La validation vit ici, donc elle s'applique aussi bien à la
 * saisie de l'administration qu'à une valeur déjà en base.
 */
export const RATIO_BORNES: Record<ExerciceId, { min: number; max: number }> = {
  pompes: { min: 1, max: 1 },
  squats: { min: 0.2, max: 10 },
  boxe: { min: 1, max: 60 },
  planche: { min: 1, max: 60 },
  tractions: { min: 0.05, max: 1 },
  // Cinq mètres par point au minimum, deux cents au maximum : en deçà la
  // course devient un marathon, au-delà elle efface la dette.
  course: { min: 0.005, max: 0.2 },
  // Une pompe murale ne peut pas coûter plus qu'une pompe au sol : le
  // plancher est donc à 1, et non en dessous.
  pompesMurales: { min: 1, max: 10 },
  // Quatre mètres par point au minimum : en deçà, une dette ordinaire
  // demanderait un semi-marathon à quelqu'un qui vient d'arriver.
  marche: { min: 0.004, max: 0.05 },
  // Les mêmes bornes que le sac : c'est le même geste, compté de la même
  // façon, et rien ne justifierait qu'un administrateur puisse régler l'un
  // dix fois plus loin que l'autre.
  shadow: { min: 1, max: 60 },
  // Une fente ne peut pas coûter moins qu'un squat : le plancher est donc à
  // celui des squats, et le plafond suit.
  fentes: { min: 0.2, max: 10 },
  chaise: { min: 1, max: 60 },
  // Un abdo vaut au plus une pompe, et au moins un dixième : en deçà, une
  // dette ordinaire demanderait plusieurs centaines de répétitions.
  abdos: { min: 0.5, max: 10 },
  gainageLateral: { min: 1, max: 60 },
  // Un burpee ne peut pas coûter moins d'un point : c'est l'exercice le plus
  // complet du lot, et le rendre moins cher qu'une pompe n'aurait pas de sens.
  burpees: { min: 0.05, max: 1 },
  corde: { min: 1, max: 60 },
  // Un dip vaut au moins autant qu'une pompe, et au plus autant qu'une
  // traction : c'est la fourchette qui l'encadre des deux côtés.
  dips: { min: 0.05, max: 1 },
};

/** Ratios tels qu'ils circulent entre la base, le serveur et le navigateur. */
export type RatiosExercices = Record<ExerciceId, number>;

/**
 * Ramène une valeur quelconque à un jeu de ratios utilisable : complet,
 * numérique, et dans les bornes. Tout ce qui manque ou déraille retombe sur
 * le défaut, exercice par exercice — une valeur illisible pour la boxe ne doit
 * pas emporter celle des squats.
 */
export function normaliserRatios(brut: unknown): RatiosExercices {
  const objet = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const out = { ...RATIOS_DEFAUT };
  for (const id of EXERCICE_IDS) {
    const v = Number(objet[id]);
    if (!Number.isFinite(v)) continue;
    const { min, max } = RATIO_BORNES[id];
    out[id] = Math.min(max, Math.max(min, v));
  }
  return out;
}

/**
 * Installe les ratios pour tout le processus.
 *
 * La conversion points → répétitions est appelée depuis une dizaine d'écrans
 * par des fonctions synchrones ; leur passer la configuration en argument
 * aurait voulu dire modifier chaque appel. Les ratios étant globaux — les
 * mêmes pour tout le monde, pas un réglage par compte — les poser sur le
 * module donne le même résultat sans propager un paramètre partout.
 *
 * Idempotent, et sans état à réinitialiser : appeler deux fois avec la même
 * valeur ne change rien.
 */
export function appliquerRatios(valeurs: unknown): RatiosExercices {
  const ratios = normaliserRatios(valeurs);
  for (const id of EXERCICE_IDS) EXERCICES[id].ratio = ratios[id];
  return ratios;
}

/** Ratios actuellement en vigueur, tels que les conversions les utilisent. */
export function ratiosActuels(): RatiosExercices {
  const out = {} as RatiosExercices;
  for (const id of EXERCICE_IDS) out[id] = EXERCICES[id].ratio;
  return out;
}

export const EXERCICE_DEFAUT: ExerciceId = "pompes";

/** Seuil de rappel par défaut, en points d'effort (≈ 5 min de boxe). */
export const RAPPEL_SEUIL_DEFAUT = 45;

/**
 * Paliers proposés pour le compteur de boxe, en SECONDES d'effort. C'est la
 * seule unité comparable entre exercices, et celle que le compteur affiche.
 * 0 désactive le rappel.
 */
export const RAPPEL_SEUILS_SEC = [0, 120, 300, 600, 900] as const;
export const RAPPEL_SEUIL_SEC_DEFAUT = 300;

/**
 * Paliers proposés pour l'avertissement de volume quotidien, en points
 * d'effort. 0 le désactive. Ce n'est jamais une limite dure : la dette reste
 * due, on signale seulement qu'on a dépassé ce qu'on s'était fixé.
 */
export const PLAFONDS_QUOTIDIENS = [0, 100, 200, 300, 500] as const;

export function isExerciceId(v: unknown): v is ExerciceId {
  return typeof v === "string" && v in EXERCICES;
}

/** Normalise une valeur venue de la base ou d'un formulaire. */
export function toExerciceId(v: unknown): ExerciceId {
  return isExerciceId(v) ? v : EXERCICE_DEFAUT;
}

/**
 * Normalise une sélection d'exercices : filtre les valeurs inconnues, retire
 * les doublons, conserve l'ordre de la liste de référence et garantit qu'au
 * moins un exercice reste sélectionné.
 */
export function toExerciceIds(v: unknown): ExerciceId[] {
  const bruts = Array.isArray(v) ? v : [v];
  const valides = EXERCICE_IDS.filter((id) => bruts.includes(id));
  return valides.length > 0 ? valides : [EXERCICE_DEFAUT];
}


/**
 * Le ratio à employer pour cet exercice.
 *
 * Sans jeu de ratios explicite, c'est celui en vigueur MAINTENANT. C'est ce
 * qu'il faut pour un aperçu, un compteur, un simulateur — tout ce qui parle du
 * présent. Ce n'est PAS ce qu'il faut pour une partie déjà enregistrée : elle
 * a été chiffrée sous un barème, et ce barème est le sien pour toujours.
 */
function ratioDe(exercice: ExerciceId, ratios?: RatiosExercices | null): number {
  const r = ratios?.[exercice];
  return typeof r === "number" && Number.isFinite(r) ? r : EXERCICES[exercice].ratio;
}

/**
 * Convertit des points d'effort en quantité concrète pour l'exercice donné :
 * un nombre de répétitions, ou un nombre de secondes.
 *
 * `ratios` gèle la conversion sur un barème donné. Une partie passée porte le
 * sien : sans lui, changer le prix d'une seconde de boxe réécrivait tout
 * l'historique — une soirée qui avait coûté 4 min 25 en affichait 8 min 50, et
 * l'effort déjà fait ne correspondait plus à rien.
 */
export function quantite(points: number, exercice: ExerciceId, ratios?: RatiosExercices | null): number {
  const def = EXERCICES[exercice];
  const brut = Math.max(0, points) * ratioDe(exercice, ratios);
  return arrondirAuPas(brut, def.pas);
}

/**
 * Arrondir au pas SANS traîner de flottant.
 *
 * Un pas décimal laisse traîner les flottants : 3 × 0,1 vaut
 * 0,30000000000000004, et la distance s'afficherait ainsi. On recale donc sur
 * le nombre de décimales du pas lui-même — `String` d'un nombre écrit toujours
 * son point, quelle que soit la langue, donc ce découpage n'a rien de local.
 *
 * **Elle est ici parce qu'elle était écrite DEUX fois.** `surLePas`, qui fait
 * avancer le compteur d'une tape, portait la même arithmétique — sous un
 * commentaire qui annonçait le contraire : « on recale sur le nombre de
 * décimales du pas, comme là-bas, plutôt que d'écrire une deuxième
 * arithmétique qui divergerait ». L'intention était juste, et c'était bien une
 * seconde arithmétique. Un commentaire qui décrit une garantie qui n'existe
 * pas se relit comme une garantie, et on cesse de vérifier.
 */
export function arrondirAuPas(valeur: number, pas: number): number {
  const arrondi = Math.round(valeur / pas) * pas;
  if (Number.isInteger(pas)) return arrondi;
  const decimales = String(pas).split(".")[1]?.length ?? 1;
  return Number(arrondi.toFixed(decimales));
}

/**
 * L'étiquette de langue au sens BCP 47 — « fr-FR », « ja-JP ».
 *
 * Elle est OPTIONNELLE partout, et son absence garde exactement le rendu
 * d'avant. C'est ce qui permet de reprendre les appelants un par un sans
 * qu'aucun écran ne change avant d'avoir été vérifié — le nombre en jeu est
 * la dette, c'est-à-dire le chiffre le plus important du produit, et une
 * erreur ici serait pire que le défaut qu'on corrige.
 */
export type EtiquetteLangue = string | undefined;

/** Un nombre dans la langue de l'écran, ou tel quel si on ne la connaît pas. */
function nombre(v: number, etiquette: EtiquetteLangue, decimales = 0): string {
  if (!etiquette) return decimales > 0 ? String(v) : String(Math.round(v));
  return new Intl.NumberFormat(etiquette, {
    maximumFractionDigits: decimales,
  }).format(v);
}

/**
 * Formate une durée en secondes : 45 → « 45 s », 850 → « 14 min 10 ».
 *
 * Avec une étiquette de langue, l'UNITÉ suit elle aussi : « 45 秒 » en
 * japonais, « 5 Min. » en allemand. Elle était écrite en toutes lettres ici,
 * donc en français dans les six langues, sur le nombre le plus visible du
 * produit. Sans étiquette, le rendu est celui d'avant — c'est ce qui a permis
 * de reprendre les appelants un par un.
 */
export function formaterDuree(totalSecondes: number, etiquette?: EtiquetteLangue): string {
  if (etiquette) return dureeLocalisee(totalSecondes, etiquette);
  const s = Math.max(0, Math.round(totalSecondes));
  if (s < 60) return `${s} s`;
  const minutes = Math.floor(s / 60);
  const reste = s % 60;
  // Les secondes gardent leurs deux chiffres : « 5 min 07 » et non « 5 min 7 »,
  // qui se lit comme cinq minutes et sept minutes. Ce n'est pas un nombre à
  // grouper, c'est un cadran.
  if (reste === 0) return `${nombre(minutes, etiquette)} min`;
  return `${nombre(minutes, etiquette)} min ${String(reste).padStart(2, "0")}`;
}

/**
 * Valeur compacte, sans nom d'exercice — pour les tableaux et les compteurs.
 * Reps → « 38 ». Temps → « 4 min 26 ».
 */
export function formaterCompact(
  points: number,
  exercice: ExerciceId,
  ratios?: RatiosExercices | null,
  etiquette?: EtiquetteLangue,
): string {
  return formaterQuantite(quantite(points, exercice, ratios), exercice, etiquette);
}

/**
 * Met en forme une quantité DÉJÀ convertie : des répétitions, des secondes,
 * des kilomètres.
 *
 * Elle existe pour les cumuls. Un total qui court sur plusieurs parties ne
 * peut pas se convertir d'un coup : chaque partie porte le barème sous lequel
 * elle a été chiffrée, et les additionner en points reviendrait à reconvertir
 * l'ensemble au barème du jour — c'est-à-dire à refaire exactement ce qu'on
 * corrige. On convertit donc partie par partie, puis on additionne des
 * quantités.
 */
export function formaterQuantite(
  q: number,
  exercice: ExerciceId,
  etiquette?: EtiquetteLangue,
): string {
  const unite = EXERCICES[exercice].unite;
  if (unite === "temps") return formaterDuree(q, etiquette);
  /**
   * La distance porte son unité : « 2,4 » seul ne dit pas des kilomètres, et
   * c'est le seul exercice dont la quantité ne se compte pas en répétitions.
   *
   * Elle codait « fr-FR » en dur, donc « 2,4 km » s'affichait ainsi en
   * anglais et en japonais, où il faut « 2.4 km ». Un séparateur décimal n'est
   * pas une coquetterie : le point est le séparateur des MILLIERS en français
   * et en allemand, et la virgule l'est en anglais.
   */
  if (unite === "distance") return uniteLocalisee(q, "kilometer", etiquette ?? "fr-FR", 1);
  return nombre(q, etiquette);
}

/**
 * Décompose un total de points par exercice en valeurs affichables. Chaque
 * exercice garde son unité : additionner des répétitions et des secondes pour
 * n'afficher qu'un seul nombre donnerait un résultat faux.
 */
export function ventiler(
  parExercice: Record<string, number>,
  ratios?: RatiosExercices | null,
  etiquette?: EtiquetteLangue,
): { id: ExerciceId; points: number; valeur: string }[] {
  return EXERCICE_IDS
    .filter((id) => (parExercice[id] ?? 0) > 0)
    .map((id) => ({
      id,
      points: parExercice[id],
      valeur: formaterCompact(parExercice[id], id, ratios, etiquette),
    }));
}

/**
 * Format court pour les axes de graphique, où la place est comptée :
 * les durées sont arrondies à la minute au-delà d'une minute.
 *
 * **Sa voisine `formaterQuantite`, quarante lignes plus haut, était passée par
 * `Intl` ; celle-ci ne l'avait pas suivie.** Elle rendait `String(q)`, donc
 * « 10000 » sur un axe français où il faut « 10 000 », « 10.000 » en allemand
 * et « 10,000 » en japonais — et elle recollait « km », « s » et « min » à la
 * main, dans les six langues. C'est la moitié non réparée d'une correction
 * déjà faite, sur la fonction d'à côté, dans le même fichier.
 *
 * L'axe est la surface la plus lue du tableau de bord : ses graduations sont
 * les seuls nombres qu'on regarde sans les chercher.
 *
 * L'étiquette reste OPTIONNELLE, comme chez sa voisine : son absence garde le
 * rendu d'avant, ce qui rend la reprise des appelants sûre un par un.
 */
export function formaterAxe(
  points: number,
  exercice: ExerciceId,
  ratios?: RatiosExercices | null,
  etiquette?: EtiquetteLangue,
): string {
  const q = quantite(points, exercice, ratios);
  const unite = EXERCICES[exercice].unite;
  if (!etiquette) {
    // Le rendu d'avant, mot pour mot, pour l'appelant qui n'a pas de langue.
    if (unite === "distance") return `${q} km`;
    if (unite !== "temps") return String(q);
    if (q < 60) return `${q}s`;
    return `${Math.round(q / 60)} min`;
  }
  if (unite === "distance") return uniteLocalisee(q, "kilometer", etiquette, 1);
  if (unite !== "temps") return nombre(q, etiquette);
  /**
   * Le temps passe par le cadran commun, jamais par `uniteLocalisee` en
   * direct : le japonais et le chinois y écrivent leur forme ronde à la main
   * — « 5分 » et non « 5 分 », que rend la donnée CLDR — pour s'accorder au
   * composé « 1分55秒 » du même module. Réécrire l'unité ici ferait diverger
   * les deux moitiés, ce que ce module a déjà payé une fois.
   *
   * L'arrondi à la minute se fait donc en SECONDES, et le cadran prend alors
   * sa branche « reste nul », qui est exactement la forme ronde voulue.
   */
  if (q < 60) return dureeLocalisee(q, etiquette);
  return dureeLocalisee(Math.round(q / 60) * 60, etiquette);
}

/**
 * Répartit une quantité entière en `n` parts dont la somme reste exacte : les
 * premières parts absorbent le reste de la division. Sert à découper une
 * session de jeu entre plusieurs exercices sans perdre ni inventer de secondes.
 */
export function repartir(total: number, n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(total / n);
  const reste = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < reste ? 1 : 0));
}

/**
 * Ventilation de la dette d'une activité entre plusieurs exercices.
 * `{ pompes: 23, boxe: 23 }` : la somme vaut toujours le coût total.
 */
export type Repartition = Partial<Record<ExerciceId, number>>;

/**
 * Ce que chaque exercice pèse dans le partage (réponse 068, « au choix »).
 *
 * Ce sont des POIDS et non des pourcentages, et la différence décide de tout :
 * un pourcentage force la somme à cent, donc décocher un exercice rend tous
 * les autres faux et oblige à les recalculer sous les yeux de quelqu'un qui
 * n'a rien demandé. Un poids, lui, survit à l'ajout comme au retrait — « deux
 * fois plus de pompes que de squats » reste vrai quand la course s'en va.
 */
export type PartsExercices = Partial<Record<ExerciceId, number>>;

/**
 * Un poids vaut UN par défaut, donc le partage à parts égales — c'est-à-dire
 * exactement le comportement d'avant. Quelqu'un qui n'ouvre jamais ce réglage
 * ne doit rien voir changer.
 */
export const PART_DEFAUT = 1;

/**
 * Zéro est REFUSÉ, et ce n'est pas une pudeur : « ne rien mettre sur cet
 * exercice » se dit déjà en le décochant. Deux façons d'exprimer la même chose
 * finissent par diverger, et c'est celle qui laisse l'exercice coché qui
 * mentirait — il figurerait dans la liste sans jamais rien recevoir.
 */
export const PART_MIN = 1;

/**
 * Le plafond n'est pas une politesse non plus. À un contre mille, la petite
 * part arrondit à zéro : l'exercice est coché, il s'affiche, et il ne reçoit
 * jamais rien. Dix suffit à dire « beaucoup plus », et garde toute part
 * au-dessus de zéro tant que la dette dépasse le nombre d'exercices cochés.
 */
export const PART_MAX = 10;

/** Ramène un poids dans ses bornes, en entier. Hors bornes vaut le défaut. */
export function toPart(brut: unknown): number {
  const n = Number(brut);
  if (!Number.isFinite(n)) return PART_DEFAUT;
  return Math.min(PART_MAX, Math.max(PART_MIN, Math.round(n)));
}

/**
 * Relit les poids rangés en base.
 *
 * Ils y sont en JSON, comme la ventilation d'une partie. Un contenu illisible
 * — une écriture d'une version antérieure, un octet perdu — retombe sur des
 * poids vides, donc sur le partage à parts égales : le repli d'un réglage de
 * confort ne peut pas être plus surprenant que son absence.
 */
export function parseParts(brut: unknown): PartsExercices {
  if (typeof brut !== "string" || brut.length === 0) return {};
  try {
    const objet = JSON.parse(brut) as Record<string, unknown>;
    if (objet === null || typeof objet !== "object" || Array.isArray(objet)) return {};
    const out: PartsExercices = {};
    for (const [cle, valeur] of Object.entries(objet)) {
      if (isExerciceId(cle) && Number.isFinite(Number(valeur))) out[cle] = toPart(valeur);
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Découpe un coût entre les exercices retenus. La somme reste exacte.
 *
 * Sans poids, c'est le partage à parts égales d'avant, au point de code près :
 * les premières parts absorbent le reste de la division. Avec des poids, c'est
 * la méthode du plus grand reste — chacun reçoit sa part entière, puis les
 * unités restantes vont aux fractions les plus grosses. À poids égaux les
 * fractions le sont aussi, l'égalité se tranche par l'ordre, et on retombe
 * donc sur `repartir` : le défaut n'est pas une seconde arithmétique qui
 * ressemble à la première, c'est la même.
 *
 * L'argument est OPTIONNEL, et il devait l'être : dix-sept appelants lisent
 * cette fonction, et son absence garde le rendu d'avant — ce qui a permis de
 * les reprendre un par un plutôt que tous à la fois.
 */
export function repartirPoints(
  total: number,
  exercices: ExerciceId[],
  parts?: PartsExercices | null,
): Repartition {
  const liste = toExerciceIds(exercices);
  const points = Math.max(0, Math.round(total));

  /**
   * Les bornes ne s'appliquent PAS ici, et c'est délibéré.
   *
   * `PART_MIN` et `PART_MAX` disent ce qu'on a le droit de CHOISIR ; ce sont
   * une règle de produit, posée là où la valeur entre — la route de réglages
   * refuse, `parseParts` ramène. Les imposer à l'arithmétique lui interdirait
   * de recevoir des poids qui ne viennent pas d'un réglage : la correction
   * d'un résultat repasse la ventilation d'ORIGINE en guise de poids, pour
   * garder les proportions d'une partie qu'on ne veut pas repartager.
   *
   * Un poids négatif ou illisible retombe sur le défaut ; une somme nulle rend
   * le partage à parts égales, faute de quoi personne ne recevrait rien.
   */
  const bruts = liste.map((id) => {
    const p = Number(parts?.[id] ?? PART_DEFAUT);
    return Number.isFinite(p) && p >= 0 ? p : PART_DEFAUT;
  });
  const totalPoids = bruts.reduce((a, b) => a + b, 0);
  const poids = totalPoids > 0 ? bruts : liste.map(() => PART_DEFAUT);
  const somme = poids.reduce((a, b) => a + b, 0);

  const exact = poids.map((p) => (points * p) / somme);
  const entiers = exact.map((v) => Math.floor(v));
  let reste = points - entiers.reduce((a, b) => a + b, 0);

  // Les unités restantes vont aux plus grosses fractions ; à fraction égale,
  // au premier de la liste. `sort` est stable depuis ES2019, donc l'égalité
  // rend l'ordre d'origine et non un ordre de moteur.
  const ordre = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of ordre) {
    if (reste <= 0) break;
    entiers[i] += 1;
    reste -= 1;
  }

  const out: Repartition = {};
  liste.forEach((id, i) => { out[id] = entiers[i]; });
  return out;
}

/**
 * Relit la ventilation stockée en base. Les lignes créées avant la
 * répartition — ou celles qui ne concernent qu'un exercice — n'en ont pas :
 * tout le coût revient alors à leur exercice unique.
 */
export function parseRepartition(
  brut: unknown,
  exercice: unknown,
  total: number,
): Repartition {
  if (typeof brut === "string" && brut.length > 0) {
    try {
      const objet = JSON.parse(brut) as Record<string, unknown>;
      const out: Repartition = {};
      for (const [cle, valeur] of Object.entries(objet)) {
        if (isExerciceId(cle) && typeof valeur === "number" && valeur >= 0) out[cle] = valeur;
      }
      if (Object.keys(out).length > 0) return out;
    } catch { /* ventilation illisible : on retombe sur l'exercice unique */ }
  }
  return { [toExerciceId(exercice)]: Math.max(0, Math.round(total)) };
}

/** Part revenant à un exercice donné dans une ventilation. */
export function partPourExercice(repartition: Repartition, exercice: ExerciceId): number {
  return repartition[exercice] ?? 0;
}


/** Secondes de travail que représente un point d'effort, pour cet exercice. */
export function secondesParPoint(exercice: ExerciceId): number {
  const def = EXERCICES[exercice];
  // Un exercice compté en temps donne déjà des secondes par point.
  if (def.unite === "temps") return def.ratio;
  // Pour une distance, `secondesParRep` porte les secondes par kilomètre :
  // c'est la même multiplication, avec une autre unité de départ.
  return def.ratio * (def.secondesParRep ?? 0);
}

/**
 * Durée totale d'effort que représente une dette, une fois partagée entre les
 * exercices retenus. C'est la seule façon de comparer 20 pompes et 2 min de
 * boxe : on les ramène au temps qu'il faut pour les faire.
 */
export function dureeEffort(
  points: number,
  exercices: ExerciceId[],
  /**
   * `parts` et jamais `poids` : dans ce projet, `poids` désigne des
   * KILOGRAMMES — `caloriesDePoints` en prend un. Deux sens sous un même nom
   * est exactement ce que ce journal reproche ailleurs à `totalPoints`.
   */
  parts?: PartsExercices | null,
): number {
  const repartition = repartirPoints(points, exercices, parts);
  return Object.entries(repartition).reduce(
    (total, [id, pts]) => total + (pts ?? 0) * secondesParPoint(toExerciceId(id)),
    0,
  );
}

/**
 * La durée d'effort telle qu'elle est AFFICHÉE, en secondes.
 *
 * `dureeEffort` rend le temps exact ; celle-ci rend la somme des quantités
 * telles qu'on les montre, arrondies au pas de chaque exercice — cinq
 * secondes pour la boxe. Les deux diffèrent de quelques secondes, et c'est
 * assez pour que l'écran se contredise : la pastille affichait « 1 min 15 »
 * pendant que le seuil d'alerte comparait 77 secondes à son plafond.
 *
 * C'est celle-ci qui fait foi partout où un nombre est montré ou comparé à un
 * seuil. `dureeEffort` reste la bonne pour un calcul de proportion, où
 * l'arrondi n'a rien à faire.
 */
export function dureeAffichee(
  points: number,
  exercices: ExerciceId[],
  /**
   * `parts` et jamais `poids` : dans ce projet, `poids` désigne des
   * KILOGRAMMES — `caloriesDePoints` en prend un. Deux sens sous un même nom
   * est exactement ce que ce journal reproche ailleurs à `totalPoints`.
   */
  parts?: PartsExercices | null,
): number {
  const repartition = repartirPoints(points, exercices, parts);
  return Object.entries(repartition).reduce(
    (total, [id, pts]) => total + quantite(pts ?? 0, toExerciceId(id)),
    0,
  );
}

/**
 * Un exercice se compte-t-il en temps ? Cette distinction commande le
 * compteur d'attente : des pompes se font tout de suite, à la fin de la
 * partie ; de la boxe ne vaut la peine qu'une fois quelques minutes cumulées.
 */
export function estEnTemps(exercice: ExerciceId): boolean {
  return EXERCICES[exercice].unite === "temps";
}

/** Ne garde que les exercices comptés en temps. */
export function exercicesEnTemps(exercices: ExerciceId[]): ExerciceId[] {
  return toExerciceIds(exercices).filter(estEnTemps);
}

/**
 * Part d'une ventilation qui revient à des exercices comptés en temps —
 * la seule qui s'accumule au lieu d'être faite dans la foulée.
 */
export function pointsEnTemps(repartition: Repartition): number {
  return Object.entries(repartition).reduce(
    (total, [id, pts]) => total + (estEnTemps(toExerciceId(id)) ? (pts ?? 0) : 0),
    0,
  );
}
