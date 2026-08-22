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
const { ZONES } = require("./zonesApex");

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

async function moteur() {
  if (renonce) throw new Error(renonce);
  if (ouvrier) return ouvrier;
  if (!ouverture) {
    ouverture = (async () => {
      const { createWorker } = require("tesseract.js");
      const w = await createWorker("eng", 1, {
        langPath: dossierDonnees(),
        gzip: false,
        // Le journal de la bibliothèque part sur la sortie standard à chaque
        // reconnaissance : illisible, et sans intérêt ici.
        logger: () => {},
        errorHandler: () => {},
      });
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
function decouper(image, zone) {
  const { nativeImage } = require("electron");
  const { width, height } = image.getSize();
  const rect = {
    x: Math.round(zone.x * width),
    y: Math.round(zone.y * height),
    width: Math.max(1, Math.round(zone.w * width)),
    height: Math.max(1, Math.round(zone.h * height)),
  };
  const morceau = image.crop(rect).resize({
    width: rect.width * zone.echelle,
    height: rect.height * zone.echelle,
    quality: "best",
  });

  // La marge est ajoutée en dessinant le morceau au centre d'un fond sombre.
  const m = 24;
  const t = morceau.getSize();
  const fond = nativeImage.createEmpty();
  // `nativeImage` ne sait pas composer : on passe par un tampon brut.
  const src = morceau.toBitmap();
  const L = t.width + m * 2;
  const H = t.height + m * 2;
  const dst = Buffer.alloc(L * H * 4, 0);
  for (let i = 3; i < dst.length; i += 4) dst[i] = 255; // opaque
  for (let y = 0; y < t.height; y++) {
    src.copy(dst, ((y + m) * L + m) * 4, y * t.width * 4, (y + 1) * t.width * 4);
  }
  void fond;
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
async function lireZone(image, zone) {
  const w = await moteur();
  const png = decouper(image, zone);
  const reponses = [];
  for (const psm of zone.modes) {
    await w.setParameters({
      tessedit_char_whitelist: zone.alphabet,
      tessedit_pageseg_mode: psm,
    });
    const { data } = await w.recognize(png);
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

/** Lit le cartouche d'éliminations, visible pendant la partie et en observation. */
async function lireCartouche(image) {
  const [eliminations, assistances, degats] = await Promise.all([
    lireZone(image, ZONES.eliminations),
    lireZone(image, ZONES.assistances),
    lireZone(image, ZONES.degats),
  ]);
  return { eliminations, assistances, degats };
}

module.exports = { lireFinDePartie, lireCartouche, lireZone, fermer, panne };
