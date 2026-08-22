// Lecture des chiffres qu'Apex dessine à l'écran.
//
// Le jeu n'expose rien à un programme tiers : le classement et les
// éliminations n'existent que peints sur l'image. On les lit donc là, sur une
// capture de notre propre écran — le même geste qu'un logiciel de diffusion,
// sans rien injecter dans le jeu ni lire sa mémoire.
//
// Les zones et la recette de lecture vivent dans `zonesApex.js`, mesurées sur
// des captures réelles avec la valeur attendue connue d'avance.

const path = require("path");
const { ZONES, BANDE_ANCRE, CARTOUCHE } = require("./zonesApex");

/**
 * Le moteur, chargé une seule fois.
 *
 * Son initialisation coûte quelques secondes : la refaire à chaque lecture
 * ferait manquer l'écran de fin, qui ne reste que le temps d'une transition.
 * On le garde donc en vie, et on l'arrête avec l'application.
 */
let ouvrier = null;
let ouverture = null;
/**
 * Le moteur a-t-il renoncé pour de bon ?
 *
 * Une variante du moteur absente de l'empaquetage faisait remonter une
 * exception non rattrapée depuis le chargeur WebAssembly, hors de toute chaîne
 * de promesses — et l'application entière tombait, au lancement du jeu, avec
 * une boîte d'erreur. Une lecture d'écran est un confort : elle n'a pas le
 * droit d'emporter le reste. Après un échec, on n'essaie plus, et on le dit
 * une fois.
 */
let renonce = null;

/**
 * Où trouver le modèle de lecture.
 *
 * La bibliothèque va le chercher sur un serveur public au premier usage. On
 * l'embarque : finir une partie ne doit pas dépendre d'un service extérieur,
 * et le fichier ne change jamais. Empaquetée, l'application lit dans
 * `resources`; en développement, dans le dossier du dépôt.
 */
function dossierDonnees() {
  const { app } = require("electron");
  return app.isPackaged
    ? path.join(process.resourcesPath, "donnees")
    : path.join(__dirname, "..", "..", "donnees");
}

/**
 * Délai de garde.
 *
 * Sans lui, une lecture qui ne rend jamais la main fige tout : la boucle se
 * protège des chevauchements par un drapeau, et ce drapeau ne retombe qu'au
 * retour de la promesse. Le cas s'est produit — le modèle était introuvable là
 * où l'application le cherchait, la bibliothèque partait le télécharger, et
 * l'attente ne finissait pas. La pastille est restée sur « lecture… » toute
 * une soirée, sans un mot.
 */
function avecDelai(promesse, ms, quoi) {
  let minuteur;
  return Promise.race([
    promesse,
    new Promise((_, rejeter) => {
      minuteur = setTimeout(() => rejeter(new Error(`${quoi} : rien après ${Math.round(ms / 1000)} s`)), ms);
    }),
  ]).finally(() => clearTimeout(minuteur));
}

async function moteur() {
  if (renonce) throw new Error(renonce);
  if (ouvrier) return ouvrier;
  if (!ouverture) {
    ouverture = (async () => {
      const { createWorker } = require("tesseract.js");
      // Le contrôle vaut mieux que l'attente : sans le fichier, la
      // bibliothèque part le chercher sur un serveur public et peut ne jamais
      // revenir. On préfère le dire tout de suite.
      const modele = path.join(dossierDonnees(), "eng.traineddata");
      if (!require("fs").existsSync(modele)) {
        throw new Error(`modèle de lecture introuvable (${modele})`);
      }
      const w = await avecDelai(createWorker("eng", 1, {
        langPath: dossierDonnees(),
        gzip: false,
        // Le journal de la bibliothèque part sur la sortie standard à chaque
        // reconnaissance : illisible, et sans intérêt ici.
        logger: () => {},
        errorHandler: () => {},
      }), 30_000, "chargement du moteur");
      ouvrier = w;
      return w;
    })().catch((err) => {
      renonce = err?.message ?? String(err);
      ouverture = null;
      throw err;
    });
  }
  return ouverture;
}

/** Ce qui a fait renoncer le moteur, ou `null` s'il va bien. */
function panne() {
  return renonce;
}

/** Arrête le moteur. Appelé à la fermeture de l'application. */
async function fermer() {
  if (ouvrier) { await ouvrier.terminate().catch(() => {}); ouvrier = null; ouverture = null; }
}

/**
 * Marge sombre ajoutée autour de chaque découpe, en pixels de l'image agrandie.
 * Le repérage de la bannière la retranche pour revenir aux pixels de l'écran.
 */
const MARGE = 24;

/**
 * Découpe une zone d'une image, agrandie, avec une marge sombre autour.
 *
 * L'agrandissement n'ajoute aucune information mais donne au lecteur des
 * glyphes de la taille qu'il attend. La marge compte autant : sans vide autour,
 * il cadre mal un chiffre isolé et rend souvent vide.
 *
 * Aucune binarisation, volontairement. Elle dégrade ici — mesuré : le seuillage
 * transformait « 1/10 » en « 110 » et « 386 » en « 586 ». Apex rend un texte
 * blanc net que le lecteur digère mieux tel quel.
 */
function decouper(image, rect, echelle) {
  const { nativeImage } = require("electron");
  const morceau = image.crop(rect).resize({
    width: rect.width * echelle,
    height: rect.height * echelle,
    quality: "best",
  });

  // La marge est ajoutée en dessinant le morceau au centre d'un fond sombre.
  const m = MARGE;
  const t = morceau.getSize();
  // `nativeImage` ne sait pas composer : on passe par un tampon brut.
  const src = morceau.toBitmap();
  const L = t.width + m * 2;
  const H = t.height + m * 2;
  const dst = Buffer.alloc(L * H * 4, 0);
  for (let i = 3; i < dst.length; i += 4) dst[i] = 255; // opaque
  for (let y = 0; y < t.height; y++) {
    src.copy(dst, ((y + m) * L + m) * 4, y * t.width * 4, (y + 1) * t.width * 4);
  }
  return nativeImage.createFromBitmap(dst, { width: L, height: H }).toPNG();
}

/**
 * Lit une zone. Plusieurs modes de segmentation sont essayés, et l'on retient
 * ce sur quoi ils s'accordent.
 *
 * Le mode change tout : « 386 » était illisible en mode ligne et parfait en
 * mode mot, sur exactement la même image. Plutôt que d'en élire un au jugé,
 * on les interroge tous et l'on garde la réponse majoritaire — un désaccord
 * est en lui-même une information, il dit que la lecture n'est pas sûre.
 */
async function lireZone(image, zone, rect = null) {
  const w = await moteur();
  const { width, height } = image.getSize();
  const cadre = rect ?? {
    x: Math.round(zone.x * width),
    y: Math.round(zone.y * height),
    width: Math.max(1, Math.round(zone.w * width)),
    height: Math.max(1, Math.round(zone.h * height)),
  };
  const png = decouper(image, cadre, zone.echelle);
  const reponses = [];
  for (const psm of zone.modes) {
    await w.setParameters({
      tessedit_char_whitelist: zone.alphabet,
      tessedit_pageseg_mode: psm,
    });
    const { data } = await avecDelai(w.recognize(png), 15_000, "lecture d'une zone");
    const valeur = zone.extraire
      ? zone.extraire(data.text)
      : Number((data.text.match(/\d+/) ?? [])[0] ?? NaN);
    if (valeur !== null && Number.isFinite(valeur)) reponses.push(valeur);
  }
  if (reponses.length === 0) return { valeur: null, accord: 0, essais: zone.modes.length };

  const comptes = new Map();
  for (const v of reponses) comptes.set(v, (comptes.get(v) ?? 0) + 1);
  const [valeur, accord] = [...comptes.entries()].sort((a, b) => b[1] - a[1])[0];
  return { valeur, accord, essais: zone.modes.length };
}

/**
 * Lit l'écran de fin de partie.
 *
 * Rend `null` si le mot « CLASSEMENT » n'apparaît pas : c'est le contrôle qui
 * évite d'inventer une partie parce qu'un menu passait par là.
 */
async function lireFinDePartie(image) {
  const classement = await lireZone(image, ZONES.classement);
  if (classement.valeur === null) return null;
  return { classement };
}

/** Les mots d'une page, que la bibliothèque range en blocs, alinéas et lignes. */
function* mots(data) {
  for (const bloc of data.blocks ?? []) {
    for (const alinea of bloc.paragraphs ?? []) {
      for (const ligne of alinea.lines ?? []) {
        yield* ligne.words ?? [];
      }
    }
  }
}

/**
 * Trouve la hauteur de la bannière « N ESCOUADES RESTANTES ».
 *
 * C'est le repère de tout le coin : le cartouche se lit à distance constante
 * d'elle. Sans bannière — écran de chargement, menu, largage — il n'y a rien à
 * lire, et c'est une réponse, pas un échec.
 *
 * @returns {Promise<number|null>} le haut du mot, en pixels de l'image.
 */
async function trouverAncre(image) {
  const w = await moteur();
  const { width, height } = image.getSize();
  const x = Math.round(width - BANDE_ANCRE.droite0 * height);
  const rect = {
    x,
    y: Math.round(BANDE_ANCRE.haut0 * height),
    width: Math.max(1, Math.round((BANDE_ANCRE.droite0 - BANDE_ANCRE.droite1) * height)),
    height: Math.max(1, Math.round((BANDE_ANCRE.haut1 - BANDE_ANCRE.haut0) * height)),
  };
  const png = decouper(image, rect, BANDE_ANCRE.echelle);
  await w.setParameters({
    tessedit_char_whitelist: "",
    tessedit_pageseg_mode: BANDE_ANCRE.modes[0],
  });
  // `blocks: true` n'est pas un détail : sans lui la bibliothèque ne rend que
  // le texte, `data.blocks` vaut `null`, et il n'y a aucune position à lire.
  const { data } = await avecDelai(
    w.recognize(png, {}, { blocks: true }), 15_000, "repérage de la bannière");
  for (const mot of mots(data)) {
    if (!BANDE_ANCRE.motif.test(mot.text ?? "")) continue;
    // La marge du découpage se retire avant de revenir aux pixels de l'écran,
    // sans quoi le repère descend d'un quart de ligne.
    return rect.y + Math.round((mot.bbox.y0 - MARGE) / BANDE_ANCRE.echelle);
  }
  return null;
}

/**
 * Lit le cartouche d'éliminations, visible dès le premier dégât de l'escouade.
 *
 * Les dégâts servent de verrou : ils sont la seule case toujours présente quand
 * le cartouche l'est, et la mieux lue des trois. Sans eux, on ne rend rien —
 * plutôt que des éliminations tirées d'un affichage de performance qui occupait
 * la place.
 */
/**
 * Trouve les nombres du cartouche, sans rien lire encore.
 *
 * On ne cherche pas des caractères mais des traits verticaux d'encre : là où
 * une colonne de la bande contient un pixel clair, il y a de l'encre. Les
 * traits se trient ensuite par largeur — les larges sont des icônes, les fins
 * des chiffres — et les chiffres voisins se regroupent en nombres.
 *
 * @returns {{x:number,y:number,width:number,height:number}[]} un rectangle par
 *   nombre, de gauche à droite.
 */
function groupesChiffres(image, ancre) {
  const { width, height } = image.getSize();
  const rect = {
    x: Math.round(width - CARTOUCHE.droite0 * height),
    y: ancre + Math.round(CARTOUCHE.dy0 * height),
    width: Math.max(1, Math.round((CARTOUCHE.droite0 - CARTOUCHE.droite1) * height)),
    height: Math.max(1, Math.round((CARTOUCHE.dy1 - CARTOUCHE.dy0) * height)),
  };
  if (rect.y < 0 || rect.y + rect.height > height) return [];

  const bande = image.crop(rect);
  const t = bande.getSize();
  const bmp = bande.toBitmap(); // BGRA
  const encre = new Array(t.width).fill(false);
  for (let x = 0; x < t.width; x++) {
    for (let y = 0; y < t.height; y++) {
      const i = (y * t.width + x) * 4;
      const vif = Math.max(bmp[i], bmp[i + 1], bmp[i + 2]);
      if (vif > CARTOUCHE.seuilEncre) { encre[x] = true; break; }
    }
  }

  const traits = [];
  let debut = null;
  for (let x = 0; x <= t.width; x++) {
    if (x < t.width && encre[x]) { if (debut === null) debut = x; }
    else if (debut !== null) { traits.push([debut, x]); debut = null; }
  }

  const max = Math.round(CARTOUCHE.largeurMaxChiffre * height);
  const min = Math.round(CARTOUCHE.largeurMinTrait * height);
  const ecart = Math.round(CARTOUCHE.ecartDansUnNombre * height);
  const chiffres = traits.filter(([a, b]) =>
    b - a >= min && b - a <= max
    // Un trait coupé par le bord de la bande n'a pas de largeur connue : on ne
    // peut donc pas dire si c'est un chiffre.
    && a > 0 && b < t.width);

  const nombres = [];
  for (const [a, b] of chiffres) {
    const dernier = nombres[nombres.length - 1];
    if (dernier && a - dernier[1] <= ecart) dernier[1] = b;
    else nombres.push([a, b]);
  }
  // Deux pixels de marge : un chiffre collé au bord de sa découpe se lit mal.
  return nombres.map(([a, b]) => ({
    x: rect.x + a - 2, y: rect.y, width: b - a + 4, height: rect.height,
  }));
}

/**
 * Lit le cartouche d'éliminations, visible dès le premier dégât de l'escouade.
 *
 * Trois nombres : éliminations, assistances, dégâts. Moins de trois, et le
 * cartouche ne dessine pas toutes ses cases — seul le dernier est sûr d'être
 * les dégâts, qui ferment toujours la ligne. On ne devine pas les autres : une
 * élimination inventée se paie en pompes.
 */
/**
 * Dernière hauteur de bannière trouvée, et quand.
 *
 * Le repérage est la seule lecture coûteuse du tour : une bande de 700 pixels
 * de large en mode « texte épars ». Le tri des traits, lui, ne coûte rien — il
 * ne fait que compter des pixels. On garde donc le repère et on ne le refait
 * qu'à intervalle, ou dès qu'il ne donne plus rien : toutes les cinq secondes,
 * une reconnaissance de cette taille se paierait en images perdues dans le jeu.
 */
let ancreConnue = null;
const ANCRE_VALIDE_MS = 30_000;

async function lireCartouche(image) {
  let ancre = ancreConnue && Date.now() - ancreConnue.quand < ANCRE_VALIDE_MS
    ? ancreConnue.y
    : null;
  let groupes = ancre === null ? [] : groupesChiffres(image, ancre);

  // Rien au repère gardé : soit le cartouche a disparu, soit le bloc a bougé.
  // Dans les deux cas, il faut regarder.
  if (groupes.length === 0 || groupes.length > 3) {
    ancre = await trouverAncre(image);
    if (ancre === null) { ancreConnue = null; return null; }
    ancreConnue = { y: ancre, quand: Date.now() };
    groupes = groupesChiffres(image, ancre);
  }

  if (groupes.length === 0) return null;
  /**
   * Plus de trois nombres, ce n'est pas le cartouche.
   *
   * C'est le garde-fou du repère gardé : posé une ligne trop bas, il tomberait
   * sur l'affichage de performance — « FPS : 163  IO : 22/18  ping : 26 ms » —
   * qui donne une dizaine de nombres. Trois cases, trois nombres au plus.
   */
  if (groupes.length > 3) return null;

  // Un seul moteur, une lecture à la fois : les lancer ensemble ferait
  // s'écraser leurs réglages de segmentation.
  const lus = [];
  for (const g of groupes) lus.push(await lireZone(image, CARTOUCHE, g));

  const vide = { valeur: null, accord: 0, essais: CARTOUCHE.modes.length };
  const degats = lus[lus.length - 1];
  if (degats.valeur === null) return null;
  const complet = lus.length === 3;
  return {
    eliminations: complet ? lus[0] : vide,
    assistances: complet ? lus[1] : vide,
    degats,
    ancre,
    groupes: lus.length,
  };
}

module.exports = { lireFinDePartie, lireCartouche, trouverAncre, groupesChiffres, lireZone, fermer, panne };
