/**
 * Capture ou compare le rendu de l'application, page par page et largeur par
 * largeur.
 *
 * Sert aux remaniements qui ne doivent rien changer à l'écran : on capture
 * avant, on remanie, on compare après. Une différence d'un seul pixel se voit,
 * là où une relecture ne verrait rien.
 *
 * Usage : node scripts/comparer-rendu.mjs <avant|apres> [dossier]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const MODE = process.argv[2] ?? "avant";
const RACINE = process.argv[3] ?? "/tmp/rendu";
const BASE = process.env.BASE_RENDU ?? "http://127.0.0.1:3311";
const CHROMIUM = "/opt/pw-browsers/chromium";

const PAGES = ["/", "/cgu", "/login", "/beta", "/telechargement", "/dashboard", "/history", "/settings"];
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
    const page = await ctx.newPage();
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
    await page.addStyleTag({
      content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
    });
    await page.waitForTimeout(1500);
    const nom = `${largeur}${chemin.replace(/\//g, "_") || "_accueil"}.png`;
    const image = await page.screenshot({ fullPage: true });
    writeFileSync(join(dossier, nom), image);
    empreintes[nom] = createHash("sha256").update(image).digest("hex").slice(0, 16);
    await ctx.close();
  }
}
writeFileSync(join(dossier, "empreintes.json"), JSON.stringify(empreintes, null, 2));
await navigateur.close();

if (MODE === "apres") {
  const avant = JSON.parse(readFileSync(join(RACINE, "avant", "empreintes.json"), "utf8"));
  const differentes = Object.keys(empreintes).filter((n) => avant[n] !== empreintes[n]);
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
