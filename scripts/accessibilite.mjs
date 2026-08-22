/**
 * Mesure d'accessibilité sur les pages réelles.
 *
 * Trois choses seulement, mais mesurées et non devinées : le contraste de
 * chaque texte visible, les commandes sans nom accessible, et les images sans
 * description. Ce sont celles qui décident si quelqu'un peut se servir de
 * l'application, et ce sont celles qu'un humain ne peut pas vérifier à l'œil.
 *
 * Usage : node scripts/accessibilite.mjs [adresse]
 */
import { readFileSync, existsSync } from "node:fs";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://127.0.0.1:3311";
const CHROMIUM = "/opt/pw-browsers/chromium";

const PAGES = ["/", "/cgu", "/confidentialite", "/login", "/beta", "/telechargement"];

/**
 * Pages qui demandent un compte. Le jeton se dépose dans un fichier par
 * l'appelant : le script ne sait pas en fabriquer, et n'a pas à savoir.
 */
const PAGES_CONNECTEES = ["/dashboard", "/history", "/settings"];
const JETON = existsSync("/tmp/jeton.txt") ? readFileSync("/tmp/jeton.txt", "utf8").trim() : null;

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
  const lire = (couleur) => {
    const m = couleur.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const [r, g, b, a] = m[1].split(",").map((x) => parseFloat(x));
    return { r, g, b, a: a === undefined ? 1 : a };
  };
  /** Fond effectif : on remonte les ancêtres jusqu'à une couleur opaque. */
  const fondDe = (el) => {
    let noeud = el;
    while (noeud && noeud !== document.documentElement) {
      const c = lire(getComputedStyle(noeud).backgroundColor);
      if (c && c.a >= 0.95) return c;
      noeud = noeud.parentElement;
    }
    return { r: 12, g: 14, b: 17, a: 1 };
  };
  const ratio = (a, b) => {
    const la = luminance(a.r, a.g, a.b);
    const lb = luminance(b.r, b.g, b.b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
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

    const avant = lire(style.color);
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
        couleur: style.color,
      });
    }
  }
  return { contrastes, sansNom, sansAlt };
};

const navigateur = await chromium.launch(
  existsSync(CHROMIUM) ? { executablePath: CHROMIUM } : {},
);
let total = 0;

const aVisiter = JETON ? [...PAGES, ...PAGES_CONNECTEES] : PAGES;
if (!JETON) console.log("(pas de jeton : seules les pages publiques sont mesurées)");

for (const chemin of aVisiter) {
  const ctx = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, locale: "fr-FR" });
  if (JETON) {
    await ctx.addCookies([{
      name: "authjs.session-token", value: JETON,
      domain: "127.0.0.1", path: "/", httpOnly: true, sameSite: "Lax",
    }]);
  }
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    try {
      sessionStorage.setItem("splash", "1");
      // La modale d'accueil et la visite recouvrent la page : on mesure ce
      // qu'il y a dessous, pas le voile.
      for (const c of Object.keys(localStorage)) {
        if (c.startsWith("low_")) localStorage.removeItem(c);
      }
      localStorage.setItem("low_onboarded", "1");
      localStorage.setItem("low_visite", "1");
    } catch {}
  });
  const reponse = await page.goto(BASE + chemin, { waitUntil: "networkidle" }).catch(() => null);
  if (!reponse || !reponse.ok()) {
    console.log(`\n${chemin} — injoignable (${reponse ? reponse.status() : "erreur"})`);
    await ctx.close();
    continue;
  }
  await page.waitForTimeout(1200);
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

  console.log(`\n═══ ${chemin}`);
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

console.log(`\n${total} constat(s).`);
await navigateur.close();
process.exit(total > 0 ? 1 : 0);
