/**
 * Ce que Riot publie, contre ce que le produit connaît.
 *
 * TROIS correspondances vivent dans `src/lib/champions.ts` — la liste des noms
 * affichés, les alias traduits, et la clé que Data Dragon emploie dans ses
 * adresses d'icônes — et aucune ne peut être gardée par un test unitaire :
 * elles décrivent un service EXTÉRIEUR. `champions.test.ts` tient leur
 * cohérence interne (pas d'entrée sans effet, pas de collision) ; il ne peut
 * pas savoir si Riot a ajouté un champion ce matin.
 *
 * Les deux façons de rouiller, et elles sont toutes deux SILENCIEUSES :
 *
 * - un champion ajouté par Riot manque à notre liste. Le champ le refuse, le
 *   bouton d'enregistrement reste éteint, et le message accuse la frappe de
 *   la personne alors que la faute est chez nous — c'est le défaut de la clé
 *   Riot refusée, déjà payé ici ;
 * - une clé fausse rend une image qui 404, donc le repli en lettre, et
 *   personne ne le remarque avant des semaines.
 *
 * Il ne tourne pas en intégration continue : il demande le réseau, et un garde
 * qui dépend d'un tiers rougit le jour où le tiers tousse. Il sert à
 * CONSTATER, pendant une campagne.
 *
 *   node scripts/champions-ddragon.mjs            # la version que le produit demande
 *   node scripts/champions-ddragon.mjs --toutes   # celle-là et la dernière publiée
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

const RACINE = process.cwd();
const SOURCE = join(RACINE, "src/lib/champions.ts");
const ICONE = join(RACINE, "src/components/ChampionIcon.tsx");

/** La version est lue dans le COMPOSANT, pas écrite ici : sinon les deux dérivent. */
function versionDemandee() {
  const m = readFileSync(ICONE, "utf8").match(
    /NEXT_PUBLIC_DDRAGON_VERSION\s*\|\|\s*"([\d.]+)"/,
  );
  if (!m) throw new Error("version Data Dragon introuvable dans ChampionIcon.tsx");
  return m[1];
}

function bloc(src, debut, fin) {
  const i = src.indexOf(debut);
  if (i < 0) throw new Error(`bloc introuvable : ${debut}`);
  const j = src.indexOf(fin, i);
  if (j < 0) throw new Error(`fin de bloc introuvable : ${debut}`);
  return src.slice(i, j);
}

function lireSource() {
  const src = readFileSync(SOURCE, "utf8");
  const noms = [...bloc(src, "export const CHAMPIONS", "];").matchAll(/"([^"]+)"/g)]
    .map((m) => m[1]);
  const table = {};
  for (const m of bloc(src, "export const CLE_DATA_DRAGON", "};")
    .matchAll(/"([^"]+)"\s*:\s*"([^"]+)"/g)) table[m[1]] = m[2];
  const alias = {};
  for (const m of bloc(src, "export const ALIAS_CHAMPIONS", "};")
    .matchAll(/"?([^":,\s][^":,]*?)"?\s*:\s*"([^"]+)"/g)) alias[m[1].trim()] = m[2];
  if (noms.length < 100) throw new Error(`liste suspecte : ${noms.length} champions lus`);
  return { noms, table, alias };
}

const cleDe = (table) => (nom) => table[nom] ?? nom.replace(/['\s.&]/g, "");

async function jsonRiot(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} sur ${url}`);
  return r.json();
}

async function comparer(version, { noms, table, alias }) {
  const cle = cleDe(table);
  const dd = (await jsonRiot(
    `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`,
  )).data;
  const cles = new Set(Object.keys(dd));
  const nomsRiot = new Set(Object.values(dd).map((c) => c.name));

  const sansIcone = noms.filter((n) => !cles.has(cle(n)));
  const manquants = [...nomsRiot].filter((n) => !noms.includes(n));
  const inconnus = noms.filter((n) => !nomsRiot.has(n));
  const aliasPerdus = Object.entries(alias)
    .filter(([, canonique]) => !noms.includes(canonique))
    .map(([localise, canonique]) => `${localise} → ${canonique}`);

  console.log(`\n═══ Data Dragon ${version}`);
  console.log(`  ${cles.size} champions chez Riot, ${noms.length} chez nous`);
  const dire = (libelle, liste) =>
    console.log(`  ${libelle} : ${liste.length ? liste.join(", ") : "aucun"}`);
  dire("clé sans icône chez Riot   ", sansIcone);
  dire("ajoutés par Riot, absents  ", manquants);
  dire("chez nous, inconnus de Riot", inconnus);
  dire("alias vers un nom absent   ", aliasPerdus);

  return sansIcone.length + manquants.length + inconnus.length + aliasPerdus.length;
}

const source = lireSource();
const demandee = versionDemandee();
const versions = [demandee];

if (process.argv.includes("--toutes")) {
  const [derniere] = await jsonRiot("https://ddragon.leagueoflegends.com/api/versions.json");
  if (derniere !== demandee) versions.push(derniere);
}

/**
 * La version que le produit DEMANDE doit être servie.
 *
 * Riot garde ses anciennes versions longtemps, mais pas éternellement : le
 * jour où elle disparaît, TOUTES les icônes tombent sur leur lettre de repli
 * d'un coup, et rien dans le dépôt ne le dit. C'est le premier contrôle, avant
 * toute comparaison.
 */
const sonde = await fetch(
  `https://ddragon.leagueoflegends.com/cdn/${demandee}/img/champion/Ahri.png`,
  { method: "HEAD" },
);
if (!sonde.ok) {
  console.error(
    `\n✗ Data Dragon ${demandee} ne sert plus les icônes (${sonde.status}). `
    + "Toutes les icônes du produit tombent sur leur lettre de repli.\n"
    + "Relever NEXT_PUBLIC_DDRAGON_VERSION, ou le défaut dans ChampionIcon.tsx.",
  );
  process.exit(1);
}
console.log(`Icônes servies en ${demandee} : oui`);

let total = 0;
for (const v of versions) total += await comparer(v, source);

console.log(`\n${total} écart(s).`);
process.exit(total > 0 ? 1 : 0);
