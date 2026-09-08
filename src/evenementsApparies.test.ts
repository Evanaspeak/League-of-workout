import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(__dirname);

/** Les fichiers de `src/`, comme les autres gardes structurels du projet. */
function fichiersSource(dossier: string, out: string[] = []): string[] {
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    if (entree.name.startsWith(".") || entree.name === "node_modules") continue;
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) fichiersSource(chemin, out);
    // Les tests sont écartés : ils NOMMENT les événements qu'ils cherchent,
    // à commencer par celui-ci, et se désigneraient eux-mêmes.
    else if (/\.tsx?$/.test(entree.name) && !/\.test\.tsx?$/.test(entree.name)) out.push(chemin);
  }
  return out;
}

/**
 * Les événements du projet sont émis d'un côté et écoutés de l'autre.
 *
 * Le produit s'en sert pour trois choses, et la première est la plus visible :
 * `wow-dette-changee` prévient la pastille, le rail, les paliers, la série,
 * le défi du jour et l'écran des amis qu'un paiement vient d'avoir lieu. Il
 * est écrit vingt-deux fois, en clair, dans quinze fichiers.
 *
 * **Une faute de frappe y est parfaitement muette.** `new Event("wow-dette-change")`
 * compile, part, et personne ne l'entend : la dette reste affichée telle
 * quelle après un paiement. C'est le défaut que ce journal décrit comme le
 * pire de tous — celui qui vient de faire ses pompes voit sa dette intacte et
 * en conclut que l'application ne marche pas.
 *
 * Et le cas le plus fragile n'est pas celui-là : `wow-invite-installation` est
 * émis depuis un SCRIPT EN LIGNE de la mise en page, à l'intérieur d'une
 * chaîne, et écouté par une constante nommée dans un composant. Aucun outil ne
 * regarde à l'intérieur d'un `dangerouslySetInnerHTML` — ni `tsc`, ni le
 * garde des textes en dur, ni le compilateur du script lui-même.
 *
 * Le discriminant est une FORME et non une liste : un événement du DOM s'écrit
 * en lettres collées (`visibilitychange`, `beforeinstallprompt`), ceux du
 * projet portent un séparateur (`wow-dette-changee`, `low:accueil-termine`).
 * Sa limite est écrite plutôt que laissée à découvrir — un événement rebaptisé
 * sans séparateur sortirait du champ du garde.
 */

/** `"nom"` littéral, ou un identifiant qu'on résout dans le même fichier. */
const ARG = String.raw`("[^"]+"|[A-Za-z_$][\w$]*)`;
const EMISSION = new RegExp(String.raw`dispatchEvent\(\s*new (?:Custom)?Event\(\s*${ARG}`, "g");
const ECOUTE = new RegExp(String.raw`(?:add|remove)EventListener\(\s*${ARG}`, "g");
const CONSTANTE = /const ([A-Za-z_$][\w$]*)\s*=\s*"([^"]+)"\s*;/g;
const EXPORTEE = /export const ([A-Za-z_$][\w$]*)\s*=\s*"([^"]+)"\s*;/g;

/** Un événement du projet porte un séparateur ; ceux du DOM n'en ont pas. */
const estDuProjet = (nom: string) => /[-:]/.test(nom);

type Recensement = {
  emis: Map<string, string[]>;
  ecoutes: Map<string, string[]>;
  nonResolus: string[];
};

function recenser(): Recensement {
  const fichiers = fichiersSource(SRC);
  const textes = new Map(fichiers.map((f) => [f, readFileSync(f, "utf8")]));

  /**
   * Les constantes EXPORTÉES de tout `src/`, pour le saut d'import.
   *
   * `SessionGuard` écoute `SESSION_MORTE`, importée de `chargerContexte` : un
   * résolveur qui ne lit que le fichier courant la déclare orpheline et envoie
   * corriger un appariement parfaitement juste. C'est le premier faux positif
   * qu'a rendu ce garde, et il portait sur la correction la plus récente du
   * journal.
   *
   * La résolution ne fait qu'UN saut et ne suit pas le chemin d'import : deux
   * constantes exportées de même nom se marcheraient dessus. Le dépôt n'en a
   * pas, et le contrôle des non-résolus dirait le jour où ça change.
   */
  const exportees = new Map<string, string>();
  for (const s of textes.values()) {
    for (const m of s.matchAll(EXPORTEE)) exportees.set(m[1], m[2]);
  }

  const emis = new Map<string, string[]>();
  const ecoutes = new Map<string, string[]>();
  const nonResolus: string[] = [];

  for (const [f, s] of textes) {
    const locales = new Map([...s.matchAll(CONSTANTE)].map((m) => [m[1], m[2]]));
    const resoudre = (brut: string) =>
      brut.startsWith('"') ? brut.slice(1, -1) : locales.get(brut) ?? exportees.get(brut);
    for (const [carte, motif] of [[emis, EMISSION], [ecoutes, ECOUTE]] as const) {
      for (const m of s.matchAll(motif)) {
        const nom = resoudre(m[1]);
        if (nom === undefined) {
          // Un identifiant qu'on ne sait pas résoudre ne se SAUTE pas : sauté,
          // il ferait passer son événement pour orphelin, c'est-à-dire qu'il
          // enverrait corriger ce qui va bien. Il se dit.
          nonResolus.push(`${relative(SRC, f)} : ${m[1]}`);
          continue;
        }
        if (!estDuProjet(nom)) continue;
        carte.set(nom, [...(carte.get(nom) ?? []), relative(SRC, f)]);
      }
    }
  }
  return { emis, ecoutes, nonResolus };
}

describe("les événements du projet", () => {
  it("se recensent vraiment, des deux côtés", () => {
    /**
     * Le témoin, et il porte tout le reste : l'état sain est « chaque nom a
     * ses deux moitiés », donc un motif devenu aveugle rendrait deux
     * ensembles vides qui s'apparient parfaitement. Le contrôle passerait au
     * vert en n'ayant rien recensé.
     */
    const { emis, ecoutes } = recenser();
    expect(emis.size).toBeGreaterThanOrEqual(3);
    expect(ecoutes.size).toBeGreaterThanOrEqual(3);
    expect([...emis.values()].flat().length).toBeGreaterThanOrEqual(10);
    expect([...ecoutes.values()].flat().length).toBeGreaterThanOrEqual(10);
  });

  it("se résolvent tous, ou le disent", () => {
    // Le garde ne se tait jamais sur ce qu'il ne comprend pas. Un nom passé
    // par une variable, une propriété ou un paramètre ressort ici, et il faut
    // venir le lui apprendre — plutôt que de le laisser accuser un innocent.
    expect(recenser().nonResolus).toEqual([]);
  });

  it("sont tous écoutés par quelqu'un", () => {
    // Une émission orpheline part et n'atteint personne : l'écran ne se
    // rafraîchit pas, et rien ne le dit.
    const { emis, ecoutes } = recenser();
    const orphelins = [...emis.entries()]
      .filter(([nom]) => !ecoutes.has(nom))
      .map(([nom, ou]) => `${nom} émis par ${ou[0]}, écouté par personne`);
    expect(orphelins).toEqual([]);
  });

  it("sont tous émis par quelqu'un", () => {
    /**
     * L'autre sens, et il attrape ce que le premier ne voit pas : un
     * `removeEventListener` dont le nom diffère de son `addEventListener`.
     * L'abonnement n'est alors jamais retiré — le composant démonté continue
     * de relire à chaque paiement, et le symptôme est une requête de plus par
     * navigation, ce qui ne ressemble pas à sa cause.
     */
    const { emis, ecoutes } = recenser();
    const orphelins = [...ecoutes.entries()]
      .filter(([nom]) => !emis.has(nom))
      .map(([nom, ou]) => `${nom} écouté par ${ou[0]}, émis par personne`);
    expect(orphelins).toEqual([]);
  });
});
