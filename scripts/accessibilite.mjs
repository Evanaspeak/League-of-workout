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
import { enLangue } from "./langue.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3311";
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
 *   node scripts/accessibilite.mjs                → les six langues
 *   node scripts/accessibilite.mjs http://… de    → l'allemand seul
 */
const LANGUES = ["fr", "en", "es", "de", "zh", "ja"];
const langueDemandee = process.argv[3];
const aTester = langueDemandee ? [langueDemandee] : LANGUES;

/**
 * Pages qui demandent un compte. Le jeton se dépose dans un fichier par
 * l'appelant : le script ne sait pas en fabriquer, et n'a pas à savoir.
 */
const PAGES_CONNECTEES = ["/dashboard", "/history", "/settings", "/bilan"];
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
  if (arrivee !== normaliser(adresse)) {
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
  if (modale) {
    console.log(`\n═══ ${langue} · ${chemin}`);
    console.log(`  NON MESURÉ : une modale recouvre la page — « ${modale} »`);
    nonMesurees += 1;
    await ctx.close();
    continue;
  }

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
  for (const chemin of aVisiter) {
    if (JETON) {
      await ctx.addCookies([{
        name: "authjs.session-token", value: JETON,
        domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax",
      }]);
    }
    // Ces deux passes-ci ne dépendent pas de la langue du texte : une seule
    // suffit, en français, qui est la langue écrite d'abord.
    const adresse = enLangue("fr", chemin);
    await page.goto(`${BASE}${adresse}`, { waitUntil: "networkidle" }).catch(() => {});
    const arrivee = new URL(page.url()).pathname.replace(/\/+$/, "") || "/";
    if (arrivee !== (adresse.replace(/\/+$/, "") || "/")) continue;

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
  for (const chemin of aVisiter) {
    if (JETON) {
      await ctx.addCookies([{
        name: "authjs.session-token", value: JETON,
        domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax",
      }]);
    }
    // Ces deux passes-ci ne dépendent pas de la langue du texte : une seule
    // suffit, en français, qui est la langue écrite d'abord.
    const adresse = enLangue("fr", chemin);
    await page.goto(`${BASE}${adresse}`, { waitUntil: "networkidle" }).catch(() => {});
    const arrivee = new URL(page.url()).pathname.replace(/\/+$/, "") || "/";
    if (arrivee !== (adresse.replace(/\/+$/, "") || "/")) continue;

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

total += horsLangue;

console.log(`\n${total} constat(s).`);
if (nonMesurees > 0) {
  console.log(`${nonMesurees} page(s) NON MESURÉE(S) — le zéro ci-dessus ne les couvre pas.`);
}
await navigateur.close();
process.exit(total > 0 ? 1 : 0);
