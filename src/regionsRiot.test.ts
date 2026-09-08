import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { REGIONS_RIOT } from "@/lib/riot-champs";

/**
 * Les régions proposées à l'écran sont celles que le serveur accepte.
 *
 * `POST /api/riot/resolve-puuid` refuse une région absente de `REGIONS_RIOT`,
 * et c'est le SEUL chemin qui relie un compte Riot. L'écran, lui, écrivait sa
 * propre liste de neuf codes.
 *
 * **Elles avaient divergé, et dans le sens qui coûte.** Le serveur en route
 * seize ; l'écran en offrait neuf. Les sept manquantes — LA1, LA2, PH2, SG2,
 * TH2, TW2, VN2 — sont l'Amérique latine et l'Asie du Sud-Est : quelqu'un qui
 * joue là-bas ne pouvait pas rattacher son compte du tout, alors que le
 * serveur l'aurait accepté sans broncher. Rien ne le signalait, et rien ne
 * pouvait le signaler : les deux listes sont justes séparément.
 *
 * C'est le septième cas de règle écrite deux fois recensé sur ce projet, et
 * c'est le premier dont les deux copies avaient RÉELLEMENT divergé — les six
 * autres coïncidaient encore, ce qui est le cas normal et ce qui rend la
 * duplication chère : elle ne se remarque qu'une fois le mal fait.
 *
 * Ce test garde ce que l'import ne peut pas garder : qu'aucun écran ne
 * revienne à sa liste en dur. Un composant qui réécrirait les seize codes
 * compilerait parfaitement.
 */

const SRC = join(process.cwd(), "src");

function fichiers(dossier: string): string[] {
  const trouves: string[] = [];
  for (const e of readdirSync(dossier, { withFileTypes: true })) {
    const complet = join(dossier, e.name);
    if (e.isDirectory()) trouves.push(...fichiers(complet));
    else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) trouves.push(complet);
  }
  return trouves;
}

/** L'écran qui doit lire la source, nommé parce qu'il est le seul. */
const ECRAN = join("src", "components", "CompteRiot.tsx");

describe("les régions Riot ne sont écrites qu'une fois", () => {
  const tous = fichiers(SRC);

  it("la source en donne bien une poignée", () => {
    // Le témoin. Sans lui, un routage vidé rendrait le contrôle suivant vert
    // en ne cherchant plus aucun code.
    expect(REGIONS_RIOT.length).toBeGreaterThanOrEqual(10);
    expect(REGIONS_RIOT).toContain("EUW1");
    expect(REGIONS_RIOT).toContain("VN2");
    expect(tous.length).toBeGreaterThan(60);
  });

  it("aucun écran ne réécrit la liste en dur", () => {
    /**
     * DEUX codes voisins entre guillemets : c'est la forme qu'une liste
     * réécrite prend forcément, et c'est ce qui la distingue d'un code
     * mentionné seul — « EUW1 » dans un exemple de Riot ID, par exemple, qui
     * est légitime.
     */
    const fautifs: string[] = [];
    for (const complet of tous) {
      const texte = readFileSync(complet, "utf8");
      for (let i = 1; i < REGIONS_RIOT.length; i += 1) {
        if (texte.includes(`"${REGIONS_RIOT[i - 1]}", "${REGIONS_RIOT[i]}"`)) {
          fautifs.push(`${complet.slice(SRC.length + 1)} : ${REGIONS_RIOT[i - 1]}, ${REGIONS_RIOT[i]}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("l'écran de rattachement lit bien la source", () => {
    // Sans ce contrôle, retirer la liste sans la remplacer passerait : le
    // précédent est un refus, pas une exigence.
    const texte = readFileSync(join(process.cwd(), ECRAN), "utf8");
    expect(texte).toMatch(/\bREGIONS_RIOT\b/);
  });
});
