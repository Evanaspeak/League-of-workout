import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { sansCommentaires } from "./test/sansCommentaires";

/**
 * Chaque page du produit est ouverte par au moins un parcours navigateur.
 *
 * Le recensement qui a motivé ce garde en a trouvé deux qui ne l'étaient par
 * personne, et la première est la plus chère :
 *
 * - `/recuperation/valider`, la dernière étape de la SEULE porte de secours du
 *   produit. Le module était éprouvé unitairement ; la page qui consomme le
 *   lien, non. Une régression y est invisible jusqu'au jour où quelqu'un en a
 *   besoin — c'est-à-dire au pire moment, et sans recours puisque c'est le
 *   recours ;
 * - `/connexion-app`, le premier écran de la connexion depuis l'application
 *   installée, dont le texte est parti en français à tout le monde jusqu'à ce
 *   qu'on le corrige.
 *
 * Le garde ne demande pas un fichier de parcours par page : il demande que le
 * chemin soit OUVERT quelque part, ou déclaré avec sa raison.
 */

const APP = join(__dirname, "app", "[locale]");
const E2E = join(__dirname, "..", "e2e");

/**
 * Ce qu'un parcours ouvre sans que son chemin y paraisse.
 *
 * Une dispense qui ne désigne plus rien tombe : c'est du code mort dans le
 * garde qui existe pour l'attraper.
 */
const DISPENSES: Record<string, string> = {
  "/introuvable":
    "ouverte par son VRAI chemin — une adresse inconnue, que le middleware réécrit. "
    + "`e2e/introuvable.spec.ts` visite `/fr/nimportequoi`, ce qui est la seule façon "
    + "d'y arriver pour de bon ; nommer la page dans un `goto` éprouverait autre chose.",
};

function pages(dossier: string, base = "", out: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) pages(chemin, `${base}/${e.name}`, out);
    else if (e.name === "page.tsx") out.push(base || "/");
  }
  return out;
}

function fichiersE2e(dossier: string, out: string[] = []): string[] {
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, e.name);
    if (e.isDirectory()) fichiersE2e(chemin, out);
    else if (/\.ts$/.test(e.name)) out.push(chemin);
  }
  return out;
}

/**
 * Le texte des parcours, PRIVÉ de ses commentaires.
 *
 * Sans ce retrait, l'explication écrite au-dessus d'un test suffit à déclarer
 * une page couverte : le fichier de la récupération NOMME `/connexion-app`
 * dans son commentaire pour dire qu'il ne la couvre pas, ce qui l'aurait fait
 * passer pour couverte. C'est le piège de `sansCommentaires`, dans son
 * quatrième sens.
 */
function texteDesParcours(): string {
  return fichiersE2e(E2E)
    .map((f) => sansCommentaires(readFileSync(f, "utf8")))
    .join("\n");
}

describe("les pages du produit", () => {
  it("se recensent vraiment, des deux côtés", () => {
    // Deux ensembles vides se couvrent parfaitement : sans ce témoin, un
    // dossier renommé rendrait le contrôle vert en ne comparant rien.
    expect(pages(APP).length).toBeGreaterThanOrEqual(15);
    expect(texteDesParcours().length).toBeGreaterThanOrEqual(20_000);
  });

  it("sont toutes ouvertes par un parcours, ou dispensées", () => {
    const texte = texteDesParcours();
    const oubliees = pages(APP)
      .filter((p) => p !== "/")
      .map((p) => ({ p, nu: p.replace(/\/\[[^\]]+\]/g, "") }))
      .filter(({ p, nu }) => {
        if (DISPENSES[p]) return false;
        // Le chemin doit être suivi d'un délimiteur : sans lui, `/bilan`
        // serait déclaré couvert par `/bilan-quelque-chose`.
        return !new RegExp(`${nu.replace(/[/]/g, "\\/")}["'\`/?#]`).test(texte);
      })
      .map(({ p }) => p);
    expect(oubliees).toEqual([]);
  });

  it("ne gardent pas une dispense qui ne désigne plus rien", () => {
    const connues = new Set(pages(APP));
    const mortes = Object.entries(DISPENSES)
      .filter(([p, raison]) => !connues.has(p) || !raison.trim())
      .map(([p]) => p);
    expect(mortes).toEqual([]);
  });
});
