/**
 * Capture ou compare le rendu de l'application, page par page et largeur par
 * largeur.
 *
 * Sert aux remaniements qui ne doivent rien changer à l'écran : on capture
 * avant, on remanie, on compare après. Une différence d'un seul pixel se voit,
 * là où une relecture ne verrait rien.
 *
 * Usage : node scripts/comparer-rendu.mjs <avant|apres> [dossier] [--langue=fr]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { enLangue, langueDemandee, positionnels } from "./langue.mjs";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const [MODE = "avant", RACINE = "/tmp/rendu"] = positionnels(process.argv);
const BASE = process.env.BASE_RENDU ?? "http://127.0.0.1:3311";
const CHROMIUM = "/opt/pw-browsers/chromium";

/**
 * `/telechargement` interroge l'API GitHub pour connaître la dernière version
 * publiée, avec un cache d'une heure. Selon que le cache est chaud ou froid au
 * moment de la capture, la page affiche le numéro de version ou ne l'affiche
 * pas — et deux séries divergent sans qu'une seule ligne de code ait bougé.
 * C'est la seule page du lot dont une différence ne prouve rien.
 */
const LANGUE_ADRESSE = langueDemandee(process.argv);
/**
 * `/settings` ne rend que la LISTE des rubriques.
 *
 * Tout ce qu'elles contiennent — la force, les exercices, les rappels, le
 * corps, les jeux — s'ouvre par un FRAGMENT, et n'a donc jamais été capturé
 * par cet outil. Deux corrections de libellé y ont vécu sans qu'une seule
 * campagne puisse les voir : le simulateur qui vouvoyait et le titre rendu
 * deux fois. Une page qu'on ne capture pas est une page qu'on ne compare pas,
 * et le rapport n'en dit rien plutôt que de le signaler.
 */
const PAGES = [
  "/", "/cgu", "/login", "/beta", "/telechargement", "/dashboard", "/history",
  "/settings", "/settings#profil", "/settings#corps", "/settings#effort",
  "/settings#jeux", "/settings#donnees",
]
  .map((c) => enLangue(LANGUE_ADRESSE, c));
const PAGES_INSTABLES = new Set(["_telechargement"]);
const LARGEURS = [360, 768, 1280];

const dossier = join(RACINE, MODE);
mkdirSync(dossier, { recursive: true });

const jeton = existsSync("/tmp/jeton.txt") ? readFileSync("/tmp/jeton.txt", "utf8").trim() : null;
/**
 * La mémoire de la modale d'accueil et de la visite est propre au compte.
 * Sans l'identifiant, elles surgissent après deux secondes et demie — donc
 * parfois avant la capture et parfois après, ce qui suffit à faire diverger
 * deux séries qui montrent pourtant la même mise en page.
 */
const compte = existsSync("/tmp/uid.txt") ? readFileSync("/tmp/uid.txt", "utf8").trim() : "";
const navigateur = await chromium.launch(existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {});
const empreintes = {};
/** Pages qui n'ont pas répondu à l'adresse demandée. */
const detournees = [];

for (const largeur of LARGEURS) {
  for (const chemin of PAGES) {
    const ctx = await navigateur.newContext({
      viewport: { width: largeur, height: 900 },
      deviceScaleFactor: 1,
      locale: "fr-FR",
      reducedMotion: "reduce",
    });
    if (jeton) {
      await ctx.addCookies([{
        name: "authjs.session-token", value: jeton,
        domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax",
      }]);
    }
    /**
     * Les icônes de champions viennent d'un CDN tiers, et l'historique en
     * demande une par partie — soixante sur un compte semé. Trois états
     * possibles au moment de la capture : l'icône est arrivée, la requête a
     * échoué (le composant montre alors la première lettre du champion), ou
     * elle est encore en vol (un carré vide). Lequel des trois dépend du CDN,
     * du proxy et de l'ordre des connexions ; l'attente d'image du script
     * borne chaque requête à quatre secondes, ce qui déplace la course sans
     * la supprimer.
     *
     * Constaté : deux séries prises sur des versions dont le rendu est
     * strictement identique différaient sur `360_fr_history`, l'une montrant
     * les lettres de repli et l'autre des carrés vides. Une différence qui ne
     * vient d'aucune ligne de code est du bruit, et du bruit dans un outil qui
     * sert à prouver qu'on n'a rien cassé est pire qu'inutile.
     *
     * Le CDN est donc COUPÉ : chaque icône tombe sur son repli, tout de suite
     * et de la même façon dans les deux séries. On ne compare plus l'icône —
     * on ne la comparait déjà pas, on comparait une course — et le reste de la
     * mise en page, qui est ce qu'on vient regarder, redevient stable.
     */
    await ctx.route("**ddragon.leagueoflegends.com**", (r) => r.abort());
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
    await page.addInitScript((uid) => {
      try {
        sessionStorage.setItem("splash", "1");
        for (const cle of ["low_onboarded", "low_visite", `low_onboarded:${uid}`, `low_visite:${uid}`]) {
          localStorage.setItem(cle, "1");
        }
      } catch {}
    }, compte);
    // Toute animation, tout curseur clignotant, toute donnée horodatée fait
    // diverger deux captures qui montrent pourtant la même mise en page.
    await page.goto(BASE + chemin, { waitUntil: "networkidle" }).catch(() => {});
    // Une session invalide renvoie les écrans connectés vers la connexion, et
    // les deux séries capturent alors la même page de connexion : la
    // comparaison rend « aucune différence » sans avoir rien comparé.
    // Le FRAGMENT ne fait pas partie du chemin : `/fr/settings#effort` arrive
    // sur `/fr/settings`, et le comparer tel quel déclarerait toutes les
    // rubriques « non représentatives » — un contrôle qui crie sur ce qui va
    // bien finit par ne plus se lire.
    const normaliser = (c) => c.split("#")[0].replace(/\/+$/, "") || "/";
    const arrivee = normaliser(new URL(page.url()).pathname);
    if (arrivee !== normaliser(chemin)) {
      console.error(`  ${chemin} : la navigation a abouti sur ${arrivee} — capture non représentative`);
      detournees.push(chemin);
    }
    await page.addStyleTag({
      content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
    });
    // Les captures de produit se chargent en différé : `networkidle` peut
    // arriver avant elles, et deux séries montrent alors des cadres vides d'un
    // côté et des images de l'autre — une différence qui ne vient d'aucune
    // ligne de code. On attend que chaque image ait réellement fini.
    await page.evaluate(async () => {
      // Une image en chargement différé sous la ligne de flottaison ne
      // commence jamais à charger tant qu'on ne l'atteint pas : l'attendre
      // sans limite bloquerait pour toujours. Chaque attente court donc
      // contre un délai.
      const attentes = [...document.images]
        .filter((i) => !i.complete)
        .map((i) => Promise.race([
          new Promise((r) => { i.onload = i.onerror = r; }),
          new Promise((r) => setTimeout(r, 4000)),
        ]));
      await Promise.all(attentes);
    }).catch(() => {});
    await page.waitForTimeout(1500);
    const nom = `${largeur}${chemin.replace(/#/g, "-").replace(/\//g, "_") || "_accueil"}.png`;
    const image = await page.screenshot({ fullPage: true });
    writeFileSync(join(dossier, nom), image);
    empreintes[nom] = createHash("sha256").update(image).digest("hex").slice(0, 16);
    await ctx.close();
  }
}
writeFileSync(join(dossier, "empreintes.json"), JSON.stringify(empreintes, null, 2));
await navigateur.close();

if (detournees.length) {
  console.error(`\n${detournees.length} page(s) détournée(s) : la série ne vaut rien tant que ce n'est pas réglé.`);
  process.exit(2);
}

if (MODE === "apres") {
  const avant = JSON.parse(readFileSync(join(RACINE, "avant", "empreintes.json"), "utf8"));
  const differentes = Object.keys(empreintes).filter((n) => avant[n] !== empreintes[n]);
  // Une page dont le contenu dépend d'un service extérieur se signale à part :
  // sa différence est une question, pas un constat.
  const instables = differentes.filter((n) => [...PAGES_INSTABLES].some((p) => n.includes(p)));
  if (instables.length) {
    console.log(`${instables.length} page(s) dépendant d'un service extérieur — à vérifier à la main :`);
    for (const n of instables) console.log(`  ${n}`);
  }
  const manquantes = Object.keys(avant).filter((n) => !(n in empreintes));
  if (differentes.length === 0 && manquantes.length === 0) {
    console.log(`${Object.keys(empreintes).length} captures, aucune différence.`);
  } else {
    console.log(`${differentes.length} capture(s) différente(s) :`);
    for (const n of differentes) console.log(`  ${n}`);
    for (const n of manquantes) console.log(`  ${n} (absente après)`);
    process.exit(1);
  }
} else {
  console.log(`${Object.keys(empreintes).length} captures de référence dans ${dossier}`);
}
