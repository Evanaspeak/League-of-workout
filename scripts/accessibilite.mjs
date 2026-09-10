/**
 * Mesure d'accessibilité sur les pages réelles.
 *
 * Ce qu'il mesure, et il ne le devine pas : le contraste de chaque texte
 * visible, les commandes et les champs sans nom accessible, les images sans
 * description, les pages qu'une fenêtre recouvre, et le contraste des
 * FRONTIÈRES de commande (critère 1.4.11, que le contrôle du texte ne peut
 * pas voir). Ce sont celles qui décident si quelqu'un peut se servir de
 * l'application, et celles qu'un humain ne peut pas vérifier à l'œil.
 *
 * **L'en-tête annonçait « trois choses seulement » et un usage qui n'existe
 * plus**, et le second coûtait le plus cher : « [adresse] [langue] » date
 * d'avant le 4 septembre, où la langue est passée au drapeau commun. Suivi à
 * la lettre, il fait tourner les SIX langues en croyant en faire une — sans
 * rien dire, puisqu'un second positionnel est simplement ignoré. C'est le
 * défaut que ce fichier vient de corriger sur le SVG, dans son propre
 * commentaire.
 *
 *   node scripts/accessibilite.mjs                    → les six langues
 *   node scripts/accessibilite.mjs --langue=de        → l'allemand seul
 *   node scripts/accessibilite.mjs http://... --langue=fr
 */
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";
import { enLangue, langueDemandee, positionnels } from "./langue.mjs";

const [BASE = "http://127.0.0.1:3311"] = positionnels(process.argv);
const CHROMIUM = "/opt/pw-browsers/chromium";

/**
 * Les pages ouvertes à tous.
 *
 * Cinq manquaient à l'appel, et ce ne sont pas les moins exposées : la liste
 * d'attente et le calculateur existent pour être trouvés par quelqu'un qui n'a
 * pas de compte, la récupération sert à celui qui n'entre plus, et la connexion
 * de l'application desktop est le premier écran qu'on y voit. Un audit qui ne
 * regarde que les pages qu'on a sous la main n'audite que celles-là.
 *
 * `/calculateur/<jeu>` figure par un exemplaire : les seize pages sortent du
 * même gabarit, et les auditer toutes ne dirait rien de plus.
 */
/**
 * Déplie ce qui est replié, avant de mesurer.
 *
 * Un bloc fermé ne rend rien : il n'a ni contraste, ni nom, ni bordure à
 * examiner, et l'audit annonce « rien à signaler » sur ce qu'il n'a jamais
 * ouvert. C'est l'angle mort déjà payé DEUX fois — les cinq rubriques des
 * réglages, puis le bloc facultatif de `/beta`, où six champs sur huit se
 * cachaient sans nom accessible pendant six semaines de rapports à zéro.
 *
 * **Mesuré des deux côtés**, le 9 septembre, sur un `htmlFor` retiré d'un
 * champ DU bloc replié : avec le dépliage, l'audit rend un constat qui nomme
 * le champ ; sans lui, zéro. Ce n'est donc pas une précaution, c'est ce qui
 * voit.
 *
 * Elle vit ici et pas dans une seule passe : les quatre l'appellent, et une
 * règle écrite quatre fois finit avec trois versions en retard.
 *
 * Plusieurs tours — déplier un bloc peut en révéler un autre. Le clic est
 * borné et son échec ignoré : un bouton qui refuse de s'ouvrir ne doit pas
 * arrêter la mesure de la page.
 */
async function deplierTout(page) {
  /**
   * Trois tours, pas six, et un clic borné à un demi-tour d'horloge.
   *
   * Le dépliage se paie sur QUATRE passes et vingt et une pages : à une
   * seconde et demie par clic manqué, il a fait déborder l'audit de son quart
   * d'heure — vingt et une pages mesurées, et les dernières passes coupées en
   * route. Un bouton qui ne s'ouvre pas en un demi-tour ne s'ouvrira pas, et
   * les rubriques de ce produit ne s'emboîtent jamais à plus de deux niveaux.
   */
  for (let passe = 0; passe < 3; passe++) {
    /**
     * On ne clique que ce qui est VISIBLE, et le prix de l'oubli est mesuré.
     *
     * `[aria-expanded="false"]` trouve aussi ce que la feuille de style
     * CACHE. Deux dépliants sont dans ce cas sur tous les écrans connectés —
     * `.nav-burger`, montrée sous 720 px, et `.rail-bascule`, montrée sous
     * 1180 px — et l'audit tourne à 1280 px : les deux y sont `display:
     * none`, donc un clic dessus ne peut qu'expirer, trois fois par page.
     *
     * Mesuré sur un compte semé à soixante parties, huit pages :
     *
     *   | page          | tous les dépliants | les visibles seuls |
     *   |---------------|--------------------|--------------------|
     *   | /dashboard    |            3796 ms |              26 ms |
     *   | /settings     |            3788 ms |              27 ms |
     *   | /amis         |            3793 ms |              25 ms |
     *   | /history      |           86262 ms |            8718 ms |
     *   | TOTAL         |          105558 ms |            9176 ms |
     *
     * L'historique est le cas extrême, et il s'explique : il rend ses lignes
     * DEUX fois — en cartes et en tableau — et c'est la feuille de style qui
     * choisit. À 1280 px, cinquante de ses cent chevrons sont donc cachés.
     *
     * Ce n'est pas qu'une affaire de temps. Un bouton que la feuille de style
     * cache n'est cliquable par personne, donc ce qu'il déplie n'est pas à
     * l'écran, donc il n'y a rien à auditer dessous : le clic ne manquait pas
     * seulement sa cible, il n'avait pas de cible.
     */
    /**
     * Le recensement se rattrape, et la RAISON a changé.
     *
     * Elle était écrite comme un fait — « un clic de dépliage peut faire
     * NAVIGUER » — et la mesure la RÉFUTE : sur les vingt et une pages
     * auditées, les dix dépliants recensés ne naviguent pas, et le seul
     * réellement cliqué hors historique est « Infos optionnelles » de `/beta`.
     *
     * Ce qu'on garde est donc le `catch`, pas son explication. `locator.all()`
     * lève sur une page fermée QUELLE QU'EN SOIT LA CAUSE, et l'audit ENTIER
     * s'arrêtait alors à sa dernière passe : vingt et une pages mesurées, et
     * un code de sortie qui disait l'inverse. On s'arrête de déplier sans
     * rien masquer — si la page est réellement perdue, la mesure qui suit le
     * dira à sa place, et c'est elle qui doit le dire.
     */
    const plies = await page.locator('[aria-expanded="false"]:visible').all().catch(() => []);
    if (!plies.length) break;
    for (const bouton of plies) {
      await bouton.click({ timeout: 500 }).catch(() => {});
    }
    await page.waitForTimeout(250).catch(() => {});
  }
}

const PAGES = [
  "/", "/cgu", "/confidentialite", "/login", "/beta", "/telechargement",
  "/recuperation", "/recuperation/valider", "/calculateur",
  "/calculateur/league-of-legends", "/connexion-app",
];

/**
 * `/obs/<jeton>` reste dehors, et pour une raison, pas par oubli : c'est une
 * source de diffusion lue par un logiciel de streaming, pas une page qu'on
 * ouvre. Elle n'a ni navigation, ni formulaire, ni lecteur d'écran en face
 * d'elle, et l'adresse elle-même est le laissez-passer.
 */

/**
 * L'audit ne tournait qu'en français, et le contraste comme le nom accessible
 * dépendent du texte affiché : un mot allemand deux fois plus long peut
 * déborder de son bouton, et une langue qui traduit mal un libellé peut le
 * vider. Une langue se passe en argument ; sans argument, on les passe toutes.
 *
 *   node scripts/accessibilite.mjs                 → les six langues
 *   node scripts/accessibilite.mjs --langue=de     → l'allemand seul
 *
 * Le drapeau est le MÊME que celui des trois autres outils, et il se pose où
 * l'on veut. Il prenait ici la place d'un argument nu, ce qui faisait de
 * `--langue=de` une adresse : quinze pages « injoignables » et un rapport à
 * zéro constat sur zéro page ouverte.
 */
const LANGUES = ["fr", "en", "es", "de", "zh", "ja"];
const demandee = process.argv.some((a) => a.startsWith("--langue="))
  ? langueDemandee(process.argv)
  : null;
const aTester = demandee ? [demandee] : LANGUES;

/**
 * Pages qui demandent un compte. Le jeton se dépose dans un fichier par
 * l'appelant : le script ne sait pas en fabriquer, et n'a pas à savoir.
 */
const PAGES_CONNECTEES = [
  "/dashboard", "/history", "/bilan", "/amis",
  // `/settings` nu ne rend que la LISTE des rubriques : tout ce qu'elles
  // contiennent — les champs du corps, les cases d'exercices, les boutons de
  // rappel, l'export — s'ouvre par un fragment, et une rubrique repliée ne
  // rend rien. L'audit ne voyait donc aucun champ de formulaire des réglages,
  // c'est-à-dire précisément ce qu'un audit existe pour regarder. C'est le
  // défaut déjà corrigé sur le balayage des coutures, dans l'outil d'à côté.
  "/settings",
  "/settings#profil", "/settings#corps", "/settings#effort",
  "/settings#jeux", "/settings#donnees",
];
const JETON = existsSync("/tmp/jeton.txt") ? readFileSync("/tmp/jeton.txt", "utf8").trim() : null;

/**
 * L'identifiant du compte audité.
 *
 * La mémoire de la modale d'accueil et de la visite lui est propre —
 * `low_onboarded:<id>`. Sans lui, les deux s'ouvrent par-dessus la page : on
 * audite alors une modale, et le rapport annonce « rien à signaler » sur des
 * écrans qu'il n'a jamais regardés. C'est arrivé, et rien ne le disait.
 */
const COMPTE = existsSync("/tmp/uid.txt") ? readFileSync("/tmp/uid.txt", "utf8").trim() : "";
if (JETON && !COMPTE) {
  console.error("Jeton présent mais /tmp/uid.txt absent : les modales d'accueil");
  console.error("recouvriraient les écrans connectés et seraient auditées à leur");
  console.error("place. Écrire l'identifiant du compte dans /tmp/uid.txt.");
  process.exit(2);
}

/*
 * Seuils WCAG AA : 4,5 pour le texte courant, 3 pour le grand texte. Ils sont
 * écrits dans la fonction de mesure plus bas, et non ici : celle-ci s'exécute
 * dans le navigateur, où rien de ce fichier n'existe.
 */

const mesure = () => {
  /** Luminance relative d'une couleur, selon la définition WCAG. */
  const luminance = (r, g, b) => {
    const c = [r, g, b].map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  /**
   * Deux formes, et il faut les DEUX.
   *
   * `rgba()` est ce que rend un littéral ou une variable de palette. Mais
   * `color-mix()` — que ce produit emploie partout depuis qu'on a nommé les
   * transparences — se calcule en `color(srgb r g b / a)`, avec des composantes
   * de 0 à 1. Un analyseur qui ne connaît que la première rend `null` sur la
   * seconde, et l'appelant SAUTE l'élément : « rien trouvé » devient
   * indiscernable de « rien regardé ». Mesuré le 9 septembre : zéro texte dans
   * ce cas, mais 114 FONDS sur dix-huit écrans.
   */
  const lire = (couleur) => {
    const rgb = String(couleur).match(/rgba?\(([^)]+)\)/);
    if (rgb) {
      const [r, g, b, a] = rgb[1].split(",").map((x) => parseFloat(x));
      return { r, g, b, a: a === undefined ? 1 : a };
    }
    const srgb = String(couleur).match(/color\(srgb\s+([^)]+)\)/);
    if (srgb) {
      const v = srgb[1].split(/[\s/]+/).filter(Boolean).map(parseFloat);
      return { r: v[0] * 255, g: v[1] * 255, b: v[2] * 255, a: v.length > 3 ? v[3] : 1 };
    }
    return null;
  };
  const composerFond = (c, fond) => ({
    r: c.r * c.a + fond.r * (1 - c.a),
    g: c.g * c.a + fond.g * (1 - c.a),
    b: c.b * c.a + fond.b * (1 - c.a),
    a: 1,
  });
  /**
   * Fond effectif : on empile les fonds TRANSLUCIDES jusqu'au premier opaque,
   * puis on les compose de bas en haut.
   *
   * L'ancienne version sautait tout ce qui n'était pas opaque à 95 % et
   * remontait au parent : un panneau teinté par-dessus l'encre faisait mesurer
   * le texte contre l'encre, c'est-à-dire contre un fond qu'il n'a jamais.
   */
  const fondDe = (el) => {
    const pile = [];
    let noeud = el;
    while (noeud && noeud !== document.documentElement) {
      const c = lire(getComputedStyle(noeud).backgroundColor);
      if (c && c.a > 0) {
        pile.push(c);
        if (c.a >= 0.95) break;
      }
      noeud = noeud.parentElement;
    }
    let fond = { r: 12, g: 14, b: 17, a: 1 };
    for (let i = pile.length - 1; i >= 0; i--) fond = composerFond(pile[i], fond);
    return fond;
  };
  const ratio = (a, b) => {
    const la = luminance(a.r, a.g, a.b);
    const lb = luminance(b.r, b.g, b.b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };

  /**
   * La couleur du texte — et un `<text>` SVG ne se peint PAS par `color`.
   *
   * Le balayage `body *` retenait déjà les `<text>` de recharts : ils portent
   * du texte propre, ils ont une boîte, ils passaient tous les filtres. Ce
   * qu'on lisait dessus était `style.color`, c'est-à-dire la couleur HÉRITÉE
   * du conteneur — `--bone` sur un panneau — quelle que soit leur vraie
   * couleur, qui vit dans `fill`.
   *
   * Mesuré sur une page fabriquée, deux `<text>` à 3,7:1 et 1,8:1 :
   *
   *     #a  color=rgb(236, 239, 244)   fill=rgb(90, 96, 104)
   *     #b  color=rgb(236, 239, 244)   fill=rgb(58, 62, 68)
   *
   * L'audit calculait donc 15:1 sur les deux. Ce n'est pas « il ne voit pas
   * le SVG » — c'est pire : **il le juge, et il conclut que tout va bien**.
   * Sept graphiques du tableau de bord et les deux courbes des réglages sont
   * dans ce cas, graduations d'axe comprises, depuis que l'audit existe.
   *
   * `fill-opacity` est une propriété distincte d'`opacity` et se multiplie à
   * l'alpha de la couleur : la sauter ferait juger un texte à demi transparent
   * comme s'il était plein.
   */
  const teinteDe = (el, style) => {
    if (!(el.ownerSVGElement || el.tagName === "svg")) return lire(style.color);
    const remplissage = lire(style.fill);
    if (!remplissage) return null;
    const fo = parseFloat(style.fillOpacity);
    return Number.isFinite(fo) ? { ...remplissage, a: remplissage.a * fo } : remplissage;
  };

  const contrastes = [];
  const sansNom = [];
  const sansAlt = [];

  for (const el of document.querySelectorAll("body *")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;

    // Commandes sans nom accessible : un lecteur d'écran annonce « bouton ».
    if (el.matches("button, a[href], [role=button]")) {
      const nom = (el.getAttribute("aria-label") || el.textContent || "").trim();
      if (!nom) sansNom.push(el.outerHTML.slice(0, 110));
    }

    /**
     * Les CHAMPS, qui n'y étaient pas — et c'est par là que le défaut est
     * passé. Un `input` ne se nomme pas par son contenu : il lui faut un
     * `aria-label`, un `aria-labelledby`, un `<label htmlFor>` ou un `<label>`
     * qui l'entoure. Un intitulé posé DEVANT lui n'étiquette rien.
     *
     * L'audit ne regardait que les boutons et les liens : les huit champs de
     * `/beta` — la seule porte d'entrée du produit — sont restés anonymes six
     * semaines sous des rapports annonçant « 0 constat ». Le zéro était
     * honnête ; il ne couvrait simplement pas cette famille.
     *
     * Le `placeholder` n'en est PAS un : il disparaît dès qu'on tape, et les
     * lecteurs d'écran ne s'accordent pas sur ce qu'ils en font.
     */
    if (el.matches("input:not([type=hidden]), select, textarea")) {
      const parId = el.id
        ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim()
        : "";
      const parLie = (el.getAttribute("aria-labelledby") || "")
        .split(/\s+/).filter(Boolean)
        .map((i) => document.getElementById(i)?.textContent?.trim() || "")
        .join(" ").trim();
      const nom = (el.getAttribute("aria-label") || "").trim()
        || parLie || parId || el.closest("label")?.textContent?.trim()
        || (el.getAttribute("title") || "").trim();
      if (!nom) sansNom.push(el.outerHTML.slice(0, 110));
    }
    if (el.tagName === "IMG" && !el.hasAttribute("alt")) {
      sansAlt.push(el.getAttribute("src") ?? "(sans source)");
    }

    // Contraste : seulement sur les éléments qui portent eux-mêmes du texte.
    const propre = Array.from(el.childNodes)
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join(" ")
      .trim();
    if (!propre) continue;

    const avant = teinteDe(el, style);
    if (!avant || avant.a < 0.5) continue;
    const taille = parseFloat(style.fontSize);
    const gras = parseInt(style.fontWeight, 10) >= 700;
    const grand = taille >= 24 || (taille >= 18.66 && gras);
    const r = ratio(avant, fondDe(el));
    const seuil = grand ? 3 : 4.5;
    if (r < seuil) {
      contrastes.push({
        texte: propre.slice(0, 52),
        ratio: Math.round(r * 100) / 100,
        seuil,
        taille: Math.round(taille * 10) / 10,
        // La couleur RAPPORTÉE est celle qu'on a mesurée, pas `style.color` :
        // sur un `<text>` SVG les deux diffèrent, et nommer la seconde envoie
        // corriger un jeton qui n'y est pour rien.
        couleur: `rgb(${[avant.r, avant.g, avant.b].map(Math.round).join(", ")})`,
      });
    }
  }
  return { contrastes, sansNom, sansAlt };
};

const navigateur = await chromium.launch(
  existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {},
);
let total = 0;
/**
 * Les pages qu'on n'a pas pu mesurer, comptées à part.
 *
 * Elles entraient dans le même compteur que les défauts trouvés. Un rapport
 * annonçant « 45 constats » pouvait donc désigner quarante-cinq pages jamais
 * atteintes — l'inverse exact d'un audit — et rien dans le total ne permettait
 * de faire la différence.
 */
let nonMesurees = 0;

const aVisiter = JETON ? [...PAGES, ...PAGES_CONNECTEES] : PAGES;

/**
 * Les trois passes de fin visitent l'adresse NUE, donc une seule fois chacune.
 *
 * Elles mesurent des choses qui ne dépendent pas du fragment — durées
 * d'animation, couleur employée seule, frontières de commande — d'où le
 * `.split("#")[0]` qu'elles écrivaient toutes les trois. Sans déduplication,
 * `/fr/settings` s'y chargeait SIX fois de suite à l'identique : la rubrique
 * nue, plus ses cinq fragments.
 *
 * Ce n'est pas gratuit, et la cause du prix est nommée. Ces trois passes
 * RÉEMPLOIENT une seule page, contrairement à la première qui ouvre un
 * contexte par adresse — et dans une page réemployée, le second chargement de
 * `/fr/settings` et les suivants mettent huit à trente secondes au lieu d'une
 * seconde deux. Le journal du réseau dit pourquoi : le routeur de Next
 * PRÉCHARGE les pages liées depuis la navigation (`?_rsc=…`), ces requêtes
 * restent en vol et finissent en `ERR_ABORTED` au bout de huit à trente
 * secondes — c'est leur abandon, et lui seul, qui déclenche `networkidle`.
 *
 * On ne touche PAS à `networkidle` pour autant : le rabattre sur `load`
 * mesurerait des écrans dont les données ne sont pas revenues, c'est-à-dire
 * exactement ce que cet outil existe pour ne pas faire.
 */
const aVisiterNu = [...new Set(aVisiter.map((c) => c.split("#")[0]))];
if (!JETON) console.log("(pas de jeton : seules les pages publiques sont mesurées)");

for (const langue of aTester) {
for (const chemin of aVisiter) {
  const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, locale: "fr-FR" });
  if (JETON) {
    await ctx.addCookies([{
      name: "authjs.session-token", value: JETON,
      domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax",
    }]);
  }
  const page = await ctx.newPage();
  /**
   * Une minute pour atteindre le silence du réseau, et non trente secondes.
   *
   * `networkidle` attend cinq cents millisecondes sans une requête. Sur
   * l'historique, chaque ligne demande son icône de champion à un domaine tiers :
   * la page met treize secondes à se taire, et **une fois sur trois elle
   * dépassait les trente secondes par défaut**. Le rapport annonçait alors une
   * page « injoignable », donc non mesurée — honnête, mais l'audit n'était plus
   * complet, et le tirage au sort décidait de quelle langue manquait.
   *
   * On ne coupe PAS le CDN ici, contrairement à `comparer-rendu.mjs` : sans lui
   * les icônes tombent sur leur repli, qui est un carré de texte et non une
   * image, donc on auditerait une autre page que celle qui est servie.
   */
  page.setDefaultNavigationTimeout(60_000);
  await page.addInitScript(([__compte]) => {
    try {
      sessionStorage.setItem("splash", "1");
      // La modale d'accueil et la visite recouvrent la page : on mesure ce
      // qu'il y a dessous, pas le voile. Le ménage vient EN PREMIER : posée
      // avant, la langue était emportée avec le reste, et l'audit tournait
      // toujours dans la langue par défaut sans le dire.
      for (const c of Object.keys(localStorage)) {
        if (c.startsWith("low_")) localStorage.removeItem(c);
      }
      // Les deux formes : l'ancienne, sans compte, et celle rattachée au
      // compte, qui est la seule que l'application lit encore.
      for (const c of ["low_onboarded", "low_visite"]) {
        localStorage.setItem(c, "1");
        if (__compte) localStorage.setItem(`${c}:${__compte}`, "1");
      }
    } catch {}
  }, [COMPTE]);
  /**
   * La langue se demande par l'ADRESSE.
   *
   * Elle se posait dans le stockage du navigateur — et le ménage des clés
   * `low_` qui précède l'emportait, ce qui a déjà fait tourner six passes en
   * français en annonçant six langues. Le problème ne se pose plus : la langue
   * est dans l'adresse, et le serveur rend la bonne version du premier coup.
   */
  const adresse = enLangue(langue, chemin);
  // Le contrôle d'atterrissage compare des CHEMINS : le fragment n'en fait
  // pas partie, et une rubrique ouverte par `#effort` atterrit sur
  // `/settings`. Sans ce retrait, les cinq rubriques sortaient « NON
  // MESURÉE » — c'est-à-dire que l'outil disait honnêtement n'avoir rien
  // regardé, mais pour une raison qui n'existait pas.
  const adresseNue = adresse.split("#")[0];
  const reponse = await page.goto(BASE + adresse, { waitUntil: "networkidle" }).catch(() => null);
  if (!reponse || !reponse.ok()) {
    console.log(`\n${adresse} — injoignable (${reponse ? reponse.status() : "erreur"})`);
    nonMesurees += 1;
    await ctx.close();
    continue;
  }
  /**
   * A-t-on bien atterri sur la page demandée ?
   *
   * Une session invalide renvoie les écrans connectés vers la connexion, et
   * une redirection répond « 200 » comme les autres. Sans ce contrôle, le
   * script mesurait la page de connexion et annonçait que le tableau de bord
   * n'avait rien à signaler. Vérifié : avec un jeton inventé, il rendait
   * « 0 constat » sur les trois écrans connectés.
   */
  const normaliser = (c) => c.replace(/\/+$/, "") || "/";
  const arrivee = normaliser(new URL(page.url()).pathname);
  if (arrivee !== normaliser(adresseNue)) {
    console.log(`\n═══ ${langue} · ${chemin}`);
    console.log(`  NON MESURÉ : la navigation a abouti sur ${arrivee}`);
    nonMesurees += 1;
    await ctx.close();
    continue;
  }
  await page.waitForTimeout(1200);

  /**
   * Une modale recouvre-t-elle la page ?
   *
   * Le contrôle d'atterrissage ci-dessus ne voit que l'adresse. Une modale
   * s'ouvre à la même adresse, prend tout l'écran et emporte le focus : ce
   * qu'on audite alors, c'est elle. Le rapport annonçait « rien à signaler »
   * sur des écrans qu'il n'avait jamais regardés — et la page dessous n'a
   * jamais été vue.
   */
  const modale = await page.evaluate(() => {
    const boites = [...document.querySelectorAll('[role="dialog"]')];
    const visible = boites.find((b) => {
      const r = b.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
    return visible ? (visible.getAttribute("aria-label") || visible.innerText || "sans nom")
      .trim().replace(/\s+/g, " ").slice(0, 60) : null;
  });
  /**
   * La feuille de style s'applique-t-elle ?
   *
   * Sans elle, tout se rend aux couleurs par DÉFAUT du navigateur : texte noir,
   * liens `rgb(0, 0, 238)`, tailles de titre du agent utilisateur. L'audit ne
   * voit alors aucune différence avec un vrai défaut — il a rendu QUATRE-VINGT-NEUF
   * constats de contraste le 9 septembre sur des pages parfaitement conformes,
   * et rien dans le rapport ne disait que l'instrument était cassé.
   *
   * C'est la famille que ce fichier attrape déjà deux fois — la page injoignable
   * et la modale qui recouvre — sous une troisième forme : ici la page est bien
   * là, elle est simplement rendue nue. Le témoin est le fond du `body` : la
   * palette le peint toujours, et son absence ne peut vouloir dire qu'une chose.
   */
  const sansStyle = await page.evaluate(() => {
    const fond = getComputedStyle(document.body).backgroundColor;
    const transparent = !fond || fond === "rgba(0, 0, 0, 0)" || fond === "transparent";
    const regles = [...document.styleSheets].reduce((n, f) => {
      try { return n + f.cssRules.length; } catch { return n; }
    }, 0);
    return transparent || regles === 0 ? { fond, regles } : null;
  });
  if (sansStyle) {
    console.log(`\n═══ ${langue} · ${chemin}`);
    console.log(`  NON MESURÉ : la page se rend SANS feuille de style ` +
      `(fond du corps « ${sansStyle.fond} », ${sansStyle.regles} règle(s)). ` +
      `Les couleurs lues seraient celles du navigateur, pas celles du produit.`);
    nonMesurees += 1;
    await ctx.close();
    continue;
  }

  if (modale) {
    console.log(`\n═══ ${langue} · ${chemin}`);
    console.log(`  NON MESURÉ : une modale recouvre la page — « ${modale} »`);
    nonMesurees += 1;
    await ctx.close();
    continue;
  }

  await deplierTout(page);

  const { contrastes, sansNom, sansAlt } = await page.evaluate(mesure);

  // Parcours au clavier : chaque arrêt doit se voir. Sans marque visible, on
  // avance à l'aveugle dans la page, ce qui rend le clavier inutilisable pour
  // qui ne peut pas se servir d'une souris.
  const sansMarque = [];
  const vus = new Set();
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const arret = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      /**
       * On compare l'élément à lui-même, une fois avec le focus et une fois
       * sans. C'est la seule mesure honnête : deviner à partir des règles CSS
       * ne dit pas si quelque chose CHANGE, et la version précédente de ce
       * contrôle comparait un style à lui-même — elle ne pouvait rien trouver.
       * Trois listes déroulantes sans contour lui avaient échappé.
       */
      const lire = () => {
        const s = getComputedStyle(el);
        return [s.outlineStyle, s.outlineWidth, s.outlineColor,
                s.boxShadow, s.borderColor, s.backgroundColor, s.color].join("|");
      };
      const avecFocus = lire();
      el.blur();
      const sansFocus = lire();
      el.focus();
      return {
        cle: `${el.tagName}.${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)}`,
        marque: avecFocus !== sansFocus,
      };
    });
    if (!arret) break;
    if (vus.has(arret.cle)) break;
    vus.add(arret.cle);
    if (!arret.marque) sansMarque.push(arret.cle);
  }

  /**
   * Les graphiques et les tableaux : ce qu'un lecteur d'écran ne peut pas
   * déduire de la forme. Un graphique sans résumé s'annonce « graphique » et
   * s'arrête là ; un tableau sans nom s'annonce par son nombre de colonnes.
   */
  const muets = await page.evaluate(() => {
    const out = [];
    const resumes = document.querySelectorAll(".lecture-ecran").length;
    const traces = document.querySelectorAll("svg.recharts-surface").length;
    if (traces > resumes) out.push(`${traces - resumes} graphique(s) sans résumé lu`);
    for (const t of document.querySelectorAll("table")) {
      if (!t.getAttribute("aria-label") && !t.querySelector("caption")) {
        out.push(`tableau sans nom (${t.querySelectorAll("tbody tr").length} lignes)`);
      }
    }
    return out;
  });

  console.log(`\n═══ ${langue} · ${chemin}`);
  if (!contrastes.length && !sansNom.length && !sansAlt.length && !sansMarque.length && !muets.length) {
    console.log("  rien à signaler");
  }
  for (const c of contrastes) {
    console.log(`  contraste ${c.ratio} < ${c.seuil}  ${c.taille}px  ${c.couleur}  « ${c.texte} »`);
  }
  for (const n of sansNom) console.log(`  commande sans nom : ${n}`);
  for (const a of sansAlt) console.log(`  image sans alt : ${a}`);
  for (const f of sansMarque) console.log(`  arrêt clavier sans marque visible : ${f}`);
  for (const m of muets) console.log(`  ${m}`);
  total += contrastes.length + sansNom.length + sansAlt.length + sansMarque.length + muets.length;
  await ctx.close();
}
}

/**
 * Deux contrôles qui ne dépendent pas de la langue, passés une seule fois.
 *
 * L'animation réduite et la couleur seule ne changent pas d'un dictionnaire à
 * l'autre : les repasser six fois allongerait la campagne sans rien apprendre.
 */
let horsLangue = 0;

/**
 * Animation réduite.
 *
 * Le système peut demander qu'on bouge moins — c'est un réglage d'accessibilité,
 * pas une préférence esthétique : pour certaines personnes, une animation
 * déclenche un vertige. On ouvre donc un contexte qui le demande, et on regarde
 * ce qui bouge encore.
 */
{
  const ctx = await navigateur.newContext({ reducedMotion: "reduce" });
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(60_000);
  for (const chemin of aVisiterNu) {
    if (JETON) {
      await ctx.addCookies([{
        name: "authjs.session-token", value: JETON,
        domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax",
      }]);
    }
    // Les trois passes de fin ne dépendent pas de la langue du texte : une
    // seule suffit, en français, qui est la langue écrite d'abord.
    const adresse = enLangue("fr", chemin);
    await page.goto(`${BASE}${adresse}`, { waitUntil: "networkidle" }).catch(() => {});
    const arrivee = new URL(page.url()).pathname.replace(/\/+$/, "") || "/";
    if (arrivee !== (adresse.replace(/\/+$/, "") || "/")) continue;
    await deplierTout(page);

    const bougent = await page.evaluate(() => {
      const out = [];
      // Au-delà d'un dixième de seconde, ce n'est plus un fondu discret.
      const SEUIL_MS = 100;
      const duree = (v) => Math.max(...String(v).split(",")
        .map((d) => (d.trim().endsWith("ms") ? parseFloat(d) : parseFloat(d) * 1000))
        .map((n) => (Number.isFinite(n) ? n : 0)), 0);
      for (const el of document.querySelectorAll("body *")) {
        const s = getComputedStyle(el);
        if (s.visibility === "hidden" || s.display === "none") continue;
        const anim = s.animationName !== "none" ? duree(s.animationDuration) : 0;
        const trans = duree(s.transitionDuration);
        if (Math.max(anim, trans) > SEUIL_MS) {
          out.push(`${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""} ${Math.round(Math.max(anim, trans))} ms`);
        }
      }
      return [...new Set(out)].slice(0, 6);
    });
    if (bougent.length) {
      console.log(`\n═══ animation réduite · ${chemin}`);
      for (const b of bougent) console.log(`  bouge encore : ${b}`);
      horsLangue += bougent.length;
    }
  }
  await ctx.close();
}

/**
 * La couleur seule.
 *
 * Victoire en vert, défaite en rouge : pour un daltonien, ce sont deux gris.
 * Le contrôle cherche les éléments peints avec l'une des deux couleurs et
 * vérifie qu'ils portent aussi du texte — une lettre, un mot, un chiffre.
 * Une pastille de couleur vide ne dit rien à qui ne distingue pas les deux.
 */
{
  const ctx = await navigateur.newContext();
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(60_000);
  for (const chemin of aVisiterNu) {
    if (JETON) {
      await ctx.addCookies([{
        name: "authjs.session-token", value: JETON,
        domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax",
      }]);
    }
    // Les trois passes de fin ne dépendent pas de la langue du texte : une
    // seule suffit, en français, qui est la langue écrite d'abord.
    const adresse = enLangue("fr", chemin);
    await page.goto(`${BASE}${adresse}`, { waitUntil: "networkidle" }).catch(() => {});
    const arrivee = new URL(page.url()).pathname.replace(/\/+$/, "") || "/";
    if (arrivee !== (adresse.replace(/\/+$/, "") || "/")) continue;
    await deplierTout(page);

    const muettes = await page.evaluate(() => {
      const CIBLES = ["rgb(47, 217, 138)", "rgb(255, 90, 71)"];
      const out = [];
      for (const el of document.querySelectorAll("body *")) {
        const s = getComputedStyle(el);
        if (!CIBLES.includes(s.color) && !CIBLES.includes(s.backgroundColor)) continue;
        if (s.visibility === "hidden" || s.display === "none") continue;
        /**
         * La couleur n'est seule que si RIEN, autour, ne dit la même chose.
         *
         * La première version ne regardait que l'élément lui-même, et signalait
         * les points décoratifs posés à côté d'un libellé — trois faux positifs
         * sur la page d'accueil. Une pastille verte suivie du mot « en ligne »
         * ne pose aucun problème : c'est le mot qui informe, le point décore.
         *
         * On remonte donc jusqu'à trois parents : si l'un d'eux porte du texte,
         * la couleur n'est pas le seul porteur du sens.
         */
        const texte = (el.textContent || "").trim();
        const nom = el.getAttribute("aria-label") || el.getAttribute("title") || "";
        if (texte || nom || el.querySelector("svg, img")) continue;
        let parent = el.parentElement;
        let entoure = false;
        for (let i = 0; i < 3 && parent; i += 1) {
          if ((parent.textContent || "").trim() !== "") { entoure = true; break; }
          parent = parent.parentElement;
        }
        if (entoure) continue;
        out.push(`${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""}`);
      }
      return [...new Set(out)].slice(0, 6);
    });
    if (muettes.length) {
      console.log(`\n═══ couleur seule · ${chemin}`);
      for (const m of muettes) console.log(`  couleur sans texte : ${m}`);
      horsLangue += muettes.length;
    }
  }
  await ctx.close();
}

/**
 * Le contraste des FRONTIÈRES, que le contrôle du texte ne peut pas voir.
 *
 * Le critère 1.4.11 des WCAG demande 3:1 entre ce qui IDENTIFIE une commande
 * et ce qui l'entoure. Pour un champ de saisie, c'est sa bordure ou son fond :
 * sans l'un des deux, on ne sait pas où taper. Les trois autres contrôles de ce
 * fichier portent tous sur du TEXTE (1.4.3), donc aucun ne regarde là.
 *
 * axe-core non plus, et c'est vérifié plutôt que supposé : sur ses cent cinq
 * règles, les deux seules de contraste sont `color-contrast` (1.4.3) et
 * `color-contrast-enhanced` (1.4.6), toutes deux sur le texte. 1.4.11 n'y est
 * pas — il est rangé du côté de ce qui se vérifie à la main. Un audit qui rend
 * « 0 constat » disait donc vrai en n'ayant jamais regardé les bordures.
 *
 * On retient le MEILLEUR des deux, et c'est la règle qui compte : un champ dont
 * le fond se détache assez de la page n'a pas besoin d'une bordure, et un champ
 * sans fond propre est identifié par sa bordure seule. Exiger les deux ferait
 * crier sur des champs parfaitement lisibles.
 *
 * Les cases à cocher, les boutons radio, les curseurs et les sélecteurs de
 * couleur sont écartés : ce sont les contrôles que le navigateur DESSINE
 * lui-même, et leur style calculé ne dit rien de ce qui est peint à l'écran.
 * Les BOUTONS, eux, y sont entrés le 9 septembre après avoir été mesurés —
 * quatre-vingt-douze, aucun sans texte visible. Ce qui les fait entrer n'est
 * pas une décision de goût mais la règle du critère : une commande sans
 * frontière visuelle est identifiée par son texte, donc elle sort du champ ;
 * une commande QUI EN A une doit atteindre 3:1. Le bouton plein passe par son
 * fond, le bouton fantôme est jugé sur sa bordure.
 *
 * Le rapport groupe par TRAITEMENT — la classe et les couleurs — et non par
 * élément : il y a quarante-huit `.lol-input` dans le produit, et quarante-huit
 * lignes identiques ne se lisent pas.
 */
{
  const ctx = await navigateur.newContext();
  const page = await ctx.newPage();
  page.setDefaultNavigationTimeout(60_000);
  /** clé de traitement → { bord, fond, meilleur, pages } */
  const traitements = new Map();
  let examines = 0;

  for (const chemin of aVisiterNu) {
    if (JETON) {
      await ctx.addCookies([{
        name: "authjs.session-token", value: JETON,
        domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax",
      }]);
    }
    const adresse = enLangue("fr", chemin);
    await page.goto(`${BASE}${adresse}`, { waitUntil: "networkidle" }).catch(() => {});
    const arrivee = new URL(page.url()).pathname.replace(/\/+$/, "") || "/";
    if (arrivee !== (adresse.replace(/\/+$/, "") || "/")) continue;
    await deplierTout(page);

    // Même garde que plus haut : sans feuille de style, il n'y a ni `.lol-input`
    // ni bordure de palette — on lirait les valeurs du navigateur.
    const nu = await page.evaluate(() => {
      const fond = getComputedStyle(document.body).backgroundColor;
      return !fond || fond === "rgba(0, 0, 0, 0)" || fond === "transparent";
    }).catch(() => false);
    if (nu) {
      console.log(`  NON MESURÉ ${chemin} : la page se rend sans feuille de style.`);
      continue;
    }

    const champs = await page.evaluate(() => {
      const luminance = (c) => {
        const [r, g, b] = c.map((v) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      // Même règle que plus haut : `color-mix` se calcule en `color(srgb …)`,
      // et un analyseur qui l'ignore rend « bordure aucune » sur une bordure
      // qui existe. C'est ce qui a fait passer `.lol-btn-danger` pour un bouton
      // sans frontière le 9 septembre.
      const lire = (couleur) => {
        const srgb = String(couleur).match(/color\(srgb\s+([^)]+)\)/);
        if (srgb) {
          const v = srgb[1].split(/[\s/]+/).filter(Boolean).map(parseFloat);
          return { rgb: [v[0] * 255, v[1] * 255, v[2] * 255], a: v.length > 3 ? v[3] : 1 };
        }
        const m = String(couleur).match(/rgba?\(([^)]+)\)/);
        if (!m) return null;
        const v = m[1].split(",").map((x) => parseFloat(x));
        return { rgb: v.slice(0, 3), a: v.length > 3 ? v[3] : 1 };
      };
      /** Compose une couleur transparente sur un fond opaque. */
      const composer = (av, arriere) =>
        av ? av.rgb.map((c, i) => c * av.a + arriere[i] * (1 - av.a)) : arriere;
      /**
       * Fond effectif : on EMPILE les fonds translucides jusqu'au premier
       * opaque, puis on les compose de bas en haut. Les sauter reviendrait à
       * mesurer une commande contre un fond qu'elle n'a jamais.
       */
      const fondOpaque = (el) => {
        const pile = [];
        let n = el;
        while (n && n !== document.documentElement) {
          const c = lire(getComputedStyle(n).backgroundColor);
          if (c && c.a > 0) {
            pile.push(c);
            if (c.a >= 0.95) break;
          }
          n = n.parentElement;
        }
        let fond = [12, 14, 17];
        for (let i = pile.length - 1; i >= 0; i--) fond = composer(pile[i], fond);
        return fond;
      };
      const ratio = (a, b) => {
        const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
        return (x + 0.05) / (y + 0.05);
      };

      const DESSINES_PAR_LE_NAVIGATEUR = [
        "hidden", "submit", "button", "reset", "checkbox", "radio", "range", "color", "file",
      ];
      const out = [];
      const CIBLES = "input, select, textarea, button, [role=button], a.lol-btn";
      for (const el of document.querySelectorAll(CIBLES)) {
        if (DESSINES_PAR_LE_NAVIGATEUR.includes(String(el.type || "").toLowerCase())
            && el.tagName !== "BUTTON") continue;
        const s = getComputedStyle(el);
        if (s.display === "none" || s.visibility === "hidden" || s.opacity === "0") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;

        const autour = fondOpaque(el.parentElement);
        // Un dégradé est opaque par construction : il peint, donc il identifie.
        const degrade = s.backgroundImage && s.backgroundImage !== "none";
        const dedans = composer(lire(s.backgroundColor), autour);
        // Une bordure de largeur nulle ne peint rien : elle n'identifie rien.
        const largeur = parseFloat(s.borderTopWidth) || 0;
        const bordure = largeur > 0 ? lire(s.borderTopColor) : null;
        const parBord = bordure && bordure.a > 0
          ? ratio(composer(bordure, dedans), dedans) : 0;
        const parFond = degrade ? 99 : ratio(dedans, autour);

        /**
         * Une commande SANS frontière visuelle sort du champ de 1.4.11, et ce
         * n'est pas une complaisance : le critère porte sur « ce qui identifie
         * une commande », et quand rien n'est peint, c'est le TEXTE qui le
         * fait — auquel 1.4.3 s'applique déjà, et que ce même outil mesure.
         *
         * C'est ce qui fait entrer les boutons ici. Mesuré le 9 septembre sur
         * quatre-vingt-douze d'entre eux : AUCUN n'est sans texte visible. Le
         * bouton plein passe par son fond, le bouton fantôme est jugé sur sa
         * bordure, et celui qui n'a ni l'un ni l'autre est hors sujet.
         */
        const sansFrontiere = parBord === 0 && parFond < 1.05;
        if (sansFrontiere) {
          const texte = (el.getAttribute("aria-label") || el.textContent || "").trim();
          if (texte) continue;
        }

        const classes = [...el.classList].filter((c) => /^lol-(btn|input|select)/.test(c));
        const cle = classes.length
          ? `${el.tagName.toLowerCase()}.${classes.join(".")}`
          : `${el.tagName.toLowerCase()} (style en ligne)`;
        out.push({
          cle,
          bord: Math.round(parBord * 100) / 100,
          fond: degrade ? "dégradé" : Math.round(parFond * 100) / 100,
          meilleur: Math.round(Math.max(parBord, parFond) * 100) / 100,
        });
      }
      return out;
    });

    examines += champs.length;
    for (const c of champs) {
      if (c.meilleur >= 3) continue;
      const vu = traitements.get(c.cle);
      if (vu) vu.pages.add(chemin);
      else traitements.set(c.cle, { ...c, pages: new Set([chemin]) });
    }
  }

  /**
   * Le témoin : sans lui, « aucune frontière à signaler » et « aucune frontière
   * REGARDÉE » s'écrivent de la même façon — un sélecteur devenu aveugle
   * rendrait le contrôle vert en n'ayant rien mesuré. C'est le défaut que ce
   * fichier attrape déjà pour les pages non mesurées, un cran plus bas.
   */
  console.log(`\n═══ frontières de commande (WCAG 1.4.11, 3:1) — ${examines} commande(s) examinée(s)`);
  if (!examines) {
    console.log("  AUCUNE commande examinée — le zéro ci-dessous ne prouve rien.");
    horsLangue += 1;
  } else if (!traitements.size) {
    console.log("  rien à signaler");
  }
  for (const [cle, t] of traitements) {
    console.log(
      `  ${cle} — bordure ${t.bord}:1, fond ${t.fond}:1 ` +
      `(${t.pages.size} page(s) : ${[...t.pages].join(", ")})`,
    );
  }
  /**
   * Ces constats-là NE FONT PAS échouer la CI, et ce n'est pas une complaisance.
   *
   * Ils décrivent une non-conformité RÉELLE — cinq traitements sur six sous
   * 3:1 — dont la correction demande de monter un jeton lu 91 fois, donc de
   * redessiner le chrome du produit. C'est un arbitrage, il appartient au
   * propriétaire, et il attend dans `docs/questions-ouvertes.md` (question 13).
   *
   * Les faire bloquer rendrait le travail `accessibilite` ROUGE à chaque
   * poussée jusqu'à ce que quelqu'un tranche. Ce fichier écrit déjà pourquoi
   * c'est le pire résultat possible : « un travail resté rouge vingt-cinq
   * versions d'affilée » fait qu'on finit par filtrer l'alerte, et qu'on ne la
   * lit plus le jour où elle compte. Les envois programmés suivent la même
   * règle — ils notent en avertissement et passent.
   *
   * Le jour où la question 13 est tranchée, cette dispense tombe et le compte
   * rejoint le total. En attendant, le garde qui MORD est statique et vit dans
   * `src/bordureChamps.test.ts` : il tient la DIRECTION — on peut monter, on ne
   * peut pas descendre — ce qui ne dépend d'aucune décision.
   */
  if (traitements.size) {
    console.log(
      `::warning::${traitements.size} frontière(s) de commande sous 3:1 ` +
      `(WCAG 1.4.11). Non bloquant : la correction attend la question 13 des ` +
      `questions ouvertes. La direction est gardée par src/bordureChamps.test.ts.`,
    );
  }
  await ctx.close();
}

total += horsLangue;

console.log(`\n${total} constat(s).`);
if (nonMesurees > 0) {
  console.log(`${nonMesurees} page(s) NON MESURÉE(S) — le zéro ci-dessus ne les couvre pas.`);
}
await navigateur.close();
process.exit(total > 0 ? 1 : 0);
