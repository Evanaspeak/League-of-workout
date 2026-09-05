/**
 * Combien de personnes en même temps avant que ça lâche.
 *
 * Le banc monte la concurrence par paliers et mesure, à chaque palier, le
 * débit, la latence médiane et la latence au 95e centile, et le taux d'échec.
 * Il s'arrête au premier palier qui casse : au-delà, on ne mesure plus le
 * produit, on mesure la file d'attente.
 *
 * Ce qui compte n'est pas le chiffre brut — il dépend de la machine — mais
 * DEUX choses qui se transportent :
 *   - le coût par requête, en temps processeur et en requêtes SQL, qui est le
 *     même partout ;
 *   - la FORME de la dégradation : là où la latence décolle avant que les
 *     erreurs n'arrivent, il reste de la marge ; là où les erreurs arrivent
 *     d'un coup, il n'y en a pas.
 *
 * Volontairement sans dépendance : un banc d'essai qui demande d'installer
 * quelque chose ne se relance pas six mois plus tard.
 *
 *   node scripts/charge.mjs [base] [chemin] [--cookie=...] [--paliers=1,5,10] [--langue=fr]
 */

import { enLangue, langueDemandee, refuserPrefixe } from "./langue.mjs";

/**
 * Ce que ce script mesure, et ce qu'il ne mesure PAS.
 *
 * Il demande une adresse, en boucle, à concurrence croissante. Sur une PAGE,
 * c'est donc le document seul : jamais les appels que le navigateur fait
 * ensuite. Une correction qui supprime des appels d'API ne s'y voit pas — le
 * regroupement du contexte a rendu 75 requêtes par seconde avant et 71 après,
 * ce qui n'est pas un échec de la correction mais un hors-sujet de la mesure.
 *
 * Pour chiffrer ce genre de changement, on mesure les ROUTES une par une et on
 * additionne leurs coûts : une page qui a besoin de trois appels consomme
 * 1/d1 + 1/d2 + 1/d3 seconde de serveur. C'est un modèle de capacité, pas un
 * débit de page observé, et il vaut ce que vaut son hypothèse — que les appels
 * ne se recouvrent pas.
 */
const args = process.argv.slice(2);
const positionnels = args.filter((a) => !a.startsWith("--"));
const option = (nom, defaut) => {
  const t = args.find((a) => a.startsWith(`--${nom}=`));
  return t ? t.slice(nom.length + 3) : defaut;
};

const BASE = positionnels[0] ?? "http://127.0.0.1:3311";
const CHEMIN = enLangue(langueDemandee(process.argv), refuserPrefixe(positionnels[1] ?? "/"));
const COOKIE = option("cookie", "");
const PALIERS = option("paliers", "1,2,5,10,20,40,80,160").split(",").map(Number);
/** Durée d'un palier. Assez long pour dépasser le régime transitoire. */
const DUREE_MS = Number(option("duree", "6000"));

/** Au-delà, le palier est déclaré cassé et on s'arrête. */
const SEUIL_ECHECS = 0.02;      // 2 % de réponses non 2xx/3xx
const SEUIL_P95_MS = 5000;      // une page qui met cinq secondes est perdue

const quantile = (tries, q) => tries[Math.min(tries.length - 1, Math.floor(tries.length * q))];

async function unePasse(concurrence) {
  const latences = [];
  let ok = 0, echecs = 0;
  const codes = new Map();
  const fin = Date.now() + DUREE_MS;

  const travailleur = async () => {
    while (Date.now() < fin) {
      const t0 = performance.now();
      try {
        const res = await fetch(BASE + CHEMIN, {
          headers: COOKIE ? { cookie: COOKIE } : {},
          redirect: "manual",
        });
        // Le corps se lit jusqu'au bout : s'arrêter aux en-têtes mesurerait le
        // temps d'ouverture du robinet, pas celui du service.
        await res.arrayBuffer();
        latences.push(performance.now() - t0);
        codes.set(res.status, (codes.get(res.status) ?? 0) + 1);
        if (res.status < 400) ok += 1; else echecs += 1;
      } catch (e) {
        latences.push(performance.now() - t0);
        echecs += 1;
        const nom = (e && e.cause && e.cause.code) || (e && e.name) || "erreur";
        codes.set(nom, (codes.get(nom) ?? 0) + 1);
      }
    }
  };

  const debut = Date.now();
  await Promise.all(Array.from({ length: concurrence }, travailleur));
  const secondes = (Date.now() - debut) / 1000;

  latences.sort((a, b) => a - b);
  const total = ok + echecs;
  return {
    concurrence,
    total,
    parSeconde: total / secondes,
    median: quantile(latences, 0.5) ?? 0,
    p95: quantile(latences, 0.95) ?? 0,
    tauxEchec: total ? echecs / total : 1,
    codes: [...codes.entries()].map(([c, n]) => `${c}×${n}`).join(" "),
  };
}

/**
 * Contrôle d'atterrissage.
 *
 * Le premier piège de tous les scripts de mesure de ce projet : mesurer une
 * page qui n'est pas celle qu'on croit. Avec un cookie périmé, on chronomètre
 * l'écran de connexion et on publie un chiffre flatteur.
 */
async function verifierOuOnEst() {
  const res = await fetch(BASE + CHEMIN, {
    headers: COOKIE ? { cookie: COOKIE } : {},
    redirect: "manual",
  });
  if (res.status >= 300 && res.status < 400) {
    const vers = res.headers.get("location") ?? "?";
    console.error(`\n  ${CHEMIN} redirige vers ${vers}.`);
    console.error("  Mesurer une redirection ne mesure rien : passe un cookie valide,");
    console.error("  ou choisis un chemin public.\n");
    process.exit(1);
  }
  if (!res.ok) {
    console.error(`\n  ${CHEMIN} répond ${res.status} avant même la charge. Rien à mesurer.\n`);
    process.exit(1);
  }
}

console.log(`\n  ${BASE}${CHEMIN}${COOKIE ? "  (avec session)" : "  (sans session)"}`);
console.log(`  paliers ${PALIERS.join(", ")} · ${DUREE_MS / 1000} s chacun\n`);
await verifierOuOnEst();

console.log("  simult.   req/s   médiane      p95   échecs   codes");
console.log("  " + "─".repeat(62));

let dernierBon = null;
for (const c of PALIERS) {
  const r = await unePasse(c);
  const casse = r.tauxEchec > SEUIL_ECHECS || r.p95 > SEUIL_P95_MS;
  console.log(
    `  ${String(r.concurrence).padStart(7)}` +
    `${r.parSeconde.toFixed(1).padStart(8)}` +
    `${(r.median.toFixed(0) + " ms").padStart(10)}` +
    `${(r.p95.toFixed(0) + " ms").padStart(9)}` +
    `${((r.tauxEchec * 100).toFixed(1) + " %").padStart(9)}   ${r.codes}` +
    (casse ? "   ← CASSÉ" : ""),
  );
  if (casse) {
    console.log(`\n  Dernier palier tenu : ${dernierBon ? dernierBon.concurrence : "aucun"} simultanés,`);
    if (dernierBon) console.log(`  soit ${dernierBon.parSeconde.toFixed(0)} requêtes par seconde.`);
    break;
  }
  dernierBon = r;
}
if (dernierBon) {
  console.log(`\n  Tenu jusqu'à ${dernierBon.concurrence} simultanés · ${dernierBon.parSeconde.toFixed(0)} req/s · p95 ${dernierBon.p95.toFixed(0)} ms`);
}
console.log();
