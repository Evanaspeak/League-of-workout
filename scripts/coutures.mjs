/**
 * Les coutures et les nombres bruts, LUS À L'ÉCRAN.
 *
 * Usage : node scripts/coutures.mjs [base] [--langue=ja] [--pages=/dashboard,/history]
 *
 * Deux familles de défauts que ce projet a payées une dizaine de fois, et que
 * les gardes statiques ne peuvent pas voir :
 *
 * - **la couture** : une espace latine assise entre deux idéogrammes. Le
 *   japonais et le chinois séparent volontiers un morceau LATIN de ce qui
 *   l'entoure (« 60 試合 »), et cette convention cesse de valoir à l'instant
 *   où la valeur interpolée est elle-même en idéogrammes — une durée passée
 *   par `Intl`, une date, un pseudo japonais. Elle ne peut donc PAS se décider
 *   à l'écriture du gabarit : la même clé reçoit « 5分20秒 » et « 38 » ;
 * - **le nombre brut** : quatre chiffres ou plus sans séparateur de milliers.
 *   Il n'existe qu'AU-DESSUS DU MILLIER, donc jamais sur un compte de
 *   démonstration : le compte doit être semé, et l'outil dit combien de textes
 *   il a lus pour qu'un « rien trouvé » ne se confonde pas avec « rien
 *   regardé ».
 *
 * Ce qui a trouvé ces défauts jusqu'ici, c'est de LIRE les écrans dans une
 * écriture différente. Cet outil fait le balayage à la main ; il ne remplace
 * pas la lecture, il l'exhausse.
 *
 * `src/coutures.test.ts` éprouve les deux motifs sur des cas fabriqués — dont
 * les défauts réels du journal. L'état sain du produit étant zéro trouvaille,
 * les écrans ne peuvent pas distinguer un motif juste d'un motif aveugle :
 * ma première version déclarait un balayage propre avec un motif qui ne
 * voyait PAS « 15360 / 25000 », c'est-à-dire le défaut pour lequel il existe.
 */
import { chromium } from "playwright";
import { existsSync, readFileSync } from "node:fs";
import { enLangue, langueDemandee, positionnels, refuserPrefixe } from "./langue.mjs";

const [BASE = "http://127.0.0.1:3311", PAGES_ARG] = positionnels(process.argv);
const LANGUE = langueDemandee(process.argv);
const CHROMIUM = "/opt/pw-browsers/chromium";

/**
 * Ce que le balayage visite par DÉFAUT.
 *
 * Les neuf écrans connectés d'abord, rubriques dépliées comprises — une
 * rubrique repliée ne rend rien, et c'est ce qui avait laissé la moitié des
 * réglages hors de tout recensement.
 *
 * Puis les dix pages PUBLIQUES, et c'est ce qui manquait : le balayage ne les
 * visitait que si on les nommait à la main. Or ce sont celles que des inconnus
 * lisent, et c'est là qu'a été trouvée la date des documents juridiques servie
 * en français aux six langues. La liste est celle de `accessibilite.mjs`, à
 * dessein : deux outils qui regardent la même surface évitent d'avoir à se
 * rappeler lequel voit quoi.
 *
 * `/obs/<jeton>` reste dehors pour la raison écrite là-bas — c'est une source
 * de diffusion, pas une page qu'on ouvre — et `/p/<jeton>` aussi : son adresse
 * demande un jeton qu'un balayage n'a pas.
 */
const PAR_DEFAUT = [
  "/dashboard", "/history", "/amis", "/bilan",
  "/settings#profil", "/settings#corps", "/settings#effort",
  "/settings#jeux", "/settings#donnees",
  "/", "/cgu", "/confidentialite", "/login", "/beta", "/telechargement",
  "/recuperation", "/calculateur", "/calculateur/league-of-legends",
  "/connexion-app",
].join(",");

const drapeauPages = process.argv.find((a) => a.startsWith("--pages="));
const PAGES = (drapeauPages ? drapeauPages.slice("--pages=".length) : PAGES_ARG ?? PAR_DEFAUT)
  .split(",").map((c) => refuserPrefixe(c.split("#")[0]) && c);

/**
 * Une espace assise ENTRE DEUX idéogrammes.
 *
 * L'espace qui suit un chiffre latin reste : c'est la convention, et un motif
 * qui la refuserait accuserait « 60 試合 », qui est juste.
 *
 * **Deux katakana de part et d'autre ne comptent pas**, et c'est un
 * resserrement, pas une exemption. 「ソロ/デュオ ランク」 sépare deux mots d'un
 * composé étranger, ce qui est la convention japonaise ; le journal gardait ce
 * constat comme un faux positif « qu'on reconnaît et qu'on laisse ». Ça tenait
 * tant que la page d'accueil n'était pas balayée par DÉFAUT. Elle l'est
 * depuis, donc le constat reviendrait à chaque exécution — et un garde qui
 * crie sur ce qui va bien finit par ne plus se lire.
 *
 * **Ce que le resserrement perd, écrit plutôt que laissé à découvrir** : une
 * valeur interpolée en katakana suivie d'un mot en katakana — un nom de jeu
 * devant un libellé, par exemple. Aucun des défauts que ce journal a payés
 * n'est de cette forme : ils cousent un idéogramme à un hiragana ou à un autre
 * idéogramme. Et « デッドバイデイライト を受け付けました » commence pourtant par
 * du katakana : c'est le côté DROIT qui décide, et il est en hiragana.
 *
 * Le motif reste un LITTÉRAL sur une ligne : `src/coutures.test.ts` le lit
 * dans cette source pour éprouver celui qui tourne, et non une copie qui
 * dériverait. La première classe porte le hiragana et les idéogrammes, la
 * seconde y ajoute le katakana — une couture demande donc au moins un côté
 * qui n'en soit pas.
 */
export const COUTURE = /[぀-ゟ㐀-鿿][  ][぀-ヿ㐀-鿿]|[぀-ヿ㐀-鿿][  ][぀-ゟ㐀-鿿]/;

/**
 * Quatre chiffres ou plus, sans séparateur de milliers.
 *
 * Les bornes disent chacune ce qu'elles écartent :
 * - devant : un chiffre, un point, une virgule ou une espace de groupement,
 *   sinon « 15,360 » et « 15 360 » seraient accusés par leur seconde moitié ;
 * - derrière : les mêmes, plus 年 et « / » et « - », qui sont des DATES —
 *   « 2026年9月7日 » et « 2026/9/6 » ne sont pas des nombres à grouper.
 *
 * La borne arrière ne peut PAS contenir l'espace ordinaire : « 15360 / 25000 »
 * est suivi d'une espace, et l'y mettre rend le motif aveugle au défaut le
 * plus fréquent de la famille. C'est exactement l'erreur commise au premier
 * jet, et elle a produit un balayage « propre » qui ne prouvait rien.
 */
export const BRUT = /(?<![\d.,  \/-])\d{4,}(?![\d.,  ]|年|\/|-)/;

/**
 * `Intl` écrirait-il ce nombre AUTREMENT ? Sinon ce n'est pas un nombre brut.
 *
 * Le motif ci-dessus cherche quatre chiffres sans séparateur, et c'est juste
 * dans cinq langues sur six. **L'espagnol ne groupe pas à quatre chiffres** :
 * `Intl.NumberFormat("es").format(2000)` rend « 2000 », et « 10.000 » à cinq.
 * Un nombre déjà passé par `Intl` y ressort donc nu, et le motif seul le
 * signalait — mesuré, quatre faux positifs sur le tableau de bord espagnol,
 * tous sur des chiffres parfaitement mis en forme.
 *
 * On DEMANDE donc à l'autorité plutôt que d'écrire un plancher par langue :
 * une liste vieillirait, `Intl` non. Le journal porte déjà ce constat depuis
 * la dette écrite « 1543 » — « c'est précisément ce qu'une table écrite à la
 * main ne saurait jamais ».
 */
export function ecritAutrement(texte, langue) {
  const m = BRUT.exec(texte);
  if (!m) return false;
  const n = Number(m[0]);
  if (!Number.isFinite(n)) return false;
  if (estAnneeDansUneDate(n, texte, langue)) return false;
  return new Intl.NumberFormat(langue).format(n) !== m[0];
}

/** Les noms de mois d'une langue, demandés à `Intl` et non écrits ici. */
const MOIS = new Map();
function moisDe(langue) {
  if (!MOIS.has(langue)) {
    const noms = new Set();
    for (const style of ["long", "short"]) {
      const f = new Intl.DateTimeFormat(langue, { month: style });
      for (let i = 0; i < 12; i += 1) {
        noms.add(f.format(new Date(Date.UTC(2026, i, 15))).toLowerCase());
      }
    }
    MOIS.set(langue, [...noms].filter((x) => /\p{L}/u.test(x)));
  }
  return MOIS.get(langue);
}

/**
 * Une ANNÉE dans une date mise en forme n'est pas un nombre brut.
 *
 * Le motif écartait déjà 年, la marque japonaise, et les séparateurs `/` et
 * `-` : les dates avaient été prévues. La date LONGUE latine ne l'était pas,
 * et l'ajout des rubriques « Ton profil » et « Tes données » au balayage l'a
 * fait sortir — « Accord donné le 7 septembre 2026 », en français, en anglais
 * et en allemand, où `Intl` grouperait 2026 en « 2 026 ». L'espagnol, le
 * japonais et le chinois se taisaient : les trois écrivent 2026 sans
 * séparateur ou avec une marque déjà exclue, ce qui montre que le silence
 * d'une langue ne prouve rien.
 *
 * Le discriminant est demandé à `Intl` lui aussi : les noms de mois de la
 * langue. Une liste écrite à la main vieillirait, et il en faudrait six.
 *
 * **Sa limite, écrite plutôt que découverte** : un texte qui nomme un mois ET
 * qui porte par ailleurs un vrai nombre brut de quatre chiffres passerait. Le
 * cas est étroit, et l'inverse — crier sur chaque date affichée — ferait
 * cesser de lire le rapport, ce qui coûte bien plus.
 */
function estAnneeDansUneDate(n, texte, langue) {
  if (!Number.isInteger(n) || n < 1900 || n > 2199) return false;
  const bas = texte.toLowerCase();
  return moisDe(langue).some((mois) => bas.includes(mois));
}
/**
 * Les langues à IDÉOGRAMMES, et pourquoi la comparaison n'a de sens qu'avec
 * l'une d'elles d'un côté.
 *
 * Un texte identique d'une langue à l'autre est soit un NOM PROPRE, soit du
 * texte en dur. Entre deux langues latines, l'identité ne prouve rien de
 * plus : « Configuration » s'écrit pareil en français et en espagnol sans que
 * personne ait rien oublié. Entre le français et le japonais, elle est la
 * DÉFINITION de ce qu'on cherche — un texte traduit change forcément
 * d'écriture.
 */
const CJK = new Set(["ja", "zh"]);

/**
 * Ce qui ne CHANGE PAS d'une langue à l'autre.
 *
 * C'est le seul détecteur possible du texte en dur SANS accent, angle mort
 * écrit trois fois au journal : `texteEnDurComposants.test.ts` cherche des
 * lettres accentuées, donc « Perfect », « Continuer avec Google » et
 * `aria-label="Fermer"` lui échappent par construction — un mot anglais sans
 * accent est indistinguable d'un identifiant.
 *
 * **Ce n'est pas un garde, c'est une LISTE À PARCOURIR**, et la distinction
 * est délibérée. Un nom propre et une chaîne en dur sont tous deux
 * invariants : aucune comparaison ne les sépare, seul un VOCABULAIRE le
 * ferait — et un vocabulaire qui doit être exhaustif pour rester muet crie le
 * jour où Riot ajoute un champion, ce qui est la façon dont meurt un garde.
 * Mesuré avant d'être écrit : 51 invariants sur seize pages, tous des noms
 * propres légitimes, dans un rapport qui lit 885 textes français et 896
 * japonais. Cinquante et une lignes se parcourent d'un coup d'œil ; huit cents
 * ne se lisent pas.
 *
 * Le seuil de trois lettres latines écarte les chiffres et la ponctuation.
 * **Sa limite, écrite plutôt que laissée à découvrir** : un texte en dur de
 * deux lettres ou moins lui échappe — « 20V / 40D » était de cette forme, et
 * c'est `dictionaries/resultat.ts` qui le tient depuis.
 */
/**
 * Trois lettres latines au moins : c'est ce qui écarte les chiffres, les
 * signes et les segments d'adresse. Le motif reste un LITTÉRAL sur une
 * ligne, comme `COUTURE` et `BRUT` : `src/coutures.test.ts` le lit dans
 * cette source pour éprouver celui qui tourne, et non une copie qui
 * dériverait.
 */
export const LATIN = /[A-Za-z]{3,}/;

export function invariants(a, b) {
  const communs = [];
  for (const [texte, chemin] of a) {
    if (!b.has(texte)) continue;
    if (!LATIN.test(texte)) continue;
    communs.push({ texte, chemin });
  }
  return communs;
}

if (import.meta.url !== `file://${process.argv[1]}`) {
  // Importé pour ses motifs : rien à balayer.
} else {
  const jeton = existsSync("/tmp/jeton.txt") ? readFileSync("/tmp/jeton.txt", "utf8").trim() : null;
  const uid = existsSync("/tmp/uid.txt") ? readFileSync("/tmp/uid.txt", "utf8").trim() : null;
  if (!jeton || !uid) {
    // Le piège écrit deux fois au journal : sans identifiant, les fenêtres
    // d'accueil recouvrent l'écran et l'outil lit la modale au lieu de la page.
    console.error("Il manque /tmp/jeton.txt ou /tmp/uid.txt. Lance d'abord"
      + " scripts/compte-mesure.mjs, puis scripts/semer-parties.mjs.");
    process.exit(1);
  }

  const drapeauInv = process.argv.find((a) => a.startsWith("--invariants="));
  const AUTRE = drapeauInv ? drapeauInv.slice("--invariants=".length) : null;
  if (AUTRE && CJK.has(LANGUE) === CJK.has(AUTRE)) {
    console.error(`--invariants demande une langue à idéogrammes d'UN SEUL côté :`
      + ` ${LANGUE} et ${AUTRE} sont toutes deux ${CJK.has(LANGUE) ? "" : "non "}CJK.`
      + ` Entre deux écritures identiques, un texte identique ne prouve rien.`);
    process.exit(1);
  }

  const nav = await chromium.launch({ executablePath: CHROMIUM });

  /** Un balayage complet dans une langue. */
  async function balayer(langue) {
    let lus = 0;
    const textes = new Map();
    const nonMesurees = [];
    const parPage = [];

    for (const chemin of PAGES) {
      const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
      await ctx.addCookies([{
        name: "authjs.session-token", value: jeton,
        domain: new URL(BASE).hostname, path: "/", httpOnly: true, sameSite: "Lax",
      }]);
      await ctx.addInitScript((id) => {
        localStorage.setItem(`low_onboarded:${id}`, "1");
        localStorage.setItem(`low_visite:${id}`, "1");
        localStorage.setItem("low_sante_consent", "1");
      }, uid);
      const page = await ctx.newPage();

      /**
       * Une page qui n'a pas eu ses données n'a rien montré, et ça ne se voit
       * pas au nombre de textes.
       *
       * Mesuré, API coupée contre API branchée : le tableau de bord passe de 145
       * à 25, l'historique de 295 à 27 — mais les RÉGLAGES rendent 137 contre
       * 141, parce que cet écran est fait de texte fixe. Un plancher ne mordrait
       * donc jamais là où il faut, et mordrait à tort sur un `/bilan` de compte
       * neuf, qui est légitimement pauvre. Ce qui tranche n'est pas la quantité,
       * c'est le RÉSEAU.
       *
       * C'est la séparation que l'audit d'accessibilité a déjà dû apprendre :
       * un défaut TROUVÉ et une page non ATTEINTE ne se comptent pas ensemble,
       * sinon « rien à signaler » veut dire « rien regardé ».
       */
      const echecs = [];
      page.on("response", (r) => {
        if (r.url().includes("/api/") && !r.ok()) {
          echecs.push(`${r.status()} sur ${new URL(r.url()).pathname}`);
        }
      });
      page.on("requestfailed", (r) => {
        if (r.url().includes("/api/")) echecs.push(`réseau coupé sur ${new URL(r.url()).pathname}`);
      });

      const [nu, fragment] = chemin.split("#");
      const adresse = BASE + enLangue(langue, nu) + (fragment ? `#${fragment}` : "");
      await page.goto(adresse, { waitUntil: "domcontentloaded" });
      // Le contrôle d'atterrissage passe APRÈS l'attente : une page peut partir
      // toute seule (la visite guidée navigue), et le vérifier avant ne le voit
      // pas. C'est la variante du premier piège de ces outils, écrite au journal.
      await page.waitForTimeout(4500);
      const arrivee = new URL(page.url()).pathname;
      if (!arrivee.endsWith(nu === "/" ? `/${langue}` : nu)) {
        nonMesurees.push(`${chemin} → ${arrivee}`);
        await ctx.close();
        continue;
      }

      if (echecs.length) {
        nonMesurees.push(`${chemin} → ${echecs[0]}`);
        await ctx.close();
        continue;
      }

      const vus = await page.evaluate(() => {
        const out = [];
        for (const e of document.querySelectorAll("body *")) {
          if (e.tagName === "SCRIPT" || e.tagName === "STYLE" || e.children.length) continue;
          const t = (e.textContent || "").trim();
          // Une adresse n'est pas une phrase : un lien de parrainage porte un
          // code qui n'a ni à être groupé ni à être coupé.
          if (t && t.length < 200 && !/^https?:/.test(t)) out.push(t);
        }
        return [...new Set(out)];
      });
      lus += vus.length;
      parPage.push({ chemin, n: vus.length });
      for (const t of vus) if (!textes.has(t)) textes.set(t, chemin);
      await ctx.close();
    }
    return { textes, lus, parPage, nonMesurees };
  }

  const principal = await balayer(LANGUE);
  const second = AUTRE ? await balayer(AUTRE) : null;
  await nav.close();

  const { textes, lus, parPage, nonMesurees } = principal;
  const constats = [];
  for (const [t, chemin] of textes) {
    if (COUTURE.test(t)) constats.push(`${chemin}  COUTURE  « ${t.slice(0, 100)} »`);
    else if (ecritAutrement(t, LANGUE)) constats.push(`${chemin}  NOMBRE   « ${t.slice(0, 100)} »`);
  }

  console.log(`\nLangue ${LANGUE} · ${PAGES.length} page(s) demandée(s) · ${lus} textes lus`);
  for (const p of parPage) console.log(`  ${String(p.n).padStart(5)}  ${p.chemin}`);
  for (const c of constats) console.log(`  ${c}`);

  // Ce qu'on n'a PAS regardé se dit AVANT le verdict, et le verdict le
  // rappelle. Un lecteur s'arrête à la première ligne : « rien à signaler »
  // imprimé au-dessus d'un bloc de pages injoignables se lit comme un
  // satisfecit, et c'est exactement ce que ce garde existe pour empêcher.
  if (nonMesurees.length) {
    console.log(`\n${nonMesurees.length} page(s) NON MESURÉE(S) :`);
    for (const n of nonMesurees) console.log(`  ${n}`);
  }
  const reste = nonMesurees.length
    ? ` — mais ${nonMesurees.length} page(s) n'ont pas été regardées`
    : "";
  console.log(
    constats.length
      ? `\n${constats.length} constat(s)${reste}.`
      : `\nRien à signaler${reste || " sur les pages mesurées"}.`,
  );

  if (second) {
    const communs = invariants(textes, second.textes);
    console.log(`\nSecond balayage en ${AUTRE} · ${second.lus} textes lus`
      + (second.nonMesurees.length ? ` · ${second.nonMesurees.length} page(s) NON MESURÉE(S)` : ""));
    for (const n of second.nonMesurees) console.log(`  ${n}`);
    console.log(`\n${communs.length} texte(s) IDENTIQUE(S) entre ${LANGUE} et ${AUTRE} :`);
    console.log("  (tous doivent être des noms propres — le reste est du texte en dur)");
    for (const c of communs) console.log(`  ${c.chemin}\t« ${c.texte.slice(0, 90)} »`);
    if (second.lus < 20) {
      console.log("\nMoins de vingt textes lus au second balayage : la comparaison ne prouve rien.");
      process.exit(1);
    }
  }

  if (lus < 20) {
    console.log("\nMoins de vingt textes lus : le balayage n'a rien regardé.");
    process.exit(1);
  }
}
