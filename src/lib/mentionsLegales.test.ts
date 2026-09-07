import fs from "fs";
import path from "path";
import { DATE_ENTREE_EN_VIGUEUR, dateEntreeEnVigueur } from "./mentionsLegales";
import { LANGUES, etiquetteLocale, type Locale } from "./i18n/langues";
import { sansCommentaires } from "../test/sansCommentaires";

/**
 * La date d'entrée en vigueur suit la langue de qui lit.
 *
 * Elle valait « 26 juin 2026 » — une chaîne française servie telle quelle aux
 * six langues. Un lecteur japonais lisait 「ベータ版 · 26 juin 2026 施行」 sur
 * le document qui l'engage, un lecteur allemand « Gültig ab 26 juin 2026 ».
 * Trouvé en balayant les pages PUBLIQUES en japonais et en chinois : le probe
 * des écrans connectés ne les regarde pas, et ce sont pourtant celles que des
 * inconnus lisent.
 *
 * La règle du projet le disait déjà — « les dates et les nombres passent par
 * `Intl`, jamais de table écrite à la main » — et elle manquait sur les deux
 * seuls textes juridiques du produit.
 */
describe("la date d'entrée en vigueur", () => {
  it("est rangée sous une forme neutre", () => {
    // Sans ça, il n'y a rien à mettre en forme : c'est déjà une langue.
    expect(DATE_ENTREE_EN_VIGUEUR).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("s'écrit dans chacune des six langues", () => {
    const rendus = new Map<Locale, string>();
    for (const l of LANGUES as readonly Locale[]) {
      const rendu = dateEntreeEnVigueur(etiquetteLocale(l));
      // Ni la forme ISO ni le mois français ne doivent traverser.
      expect({ l, iso: rendu === DATE_ENTREE_EN_VIGUEUR }).toEqual({ l, iso: false });
      rendus.set(l, rendu);
    }
    expect(rendus.size).toBe(6);
    // Au moins quatre écritures distinctes : le français et l'espagnol peuvent
    // coïncider, l'exiger toutes différentes ferait un test faux.
    expect(new Set(rendus.values()).size).toBeGreaterThanOrEqual(4);
    expect(rendus.get("ja")).toMatch(/2026年6月26日/);
    expect(rendus.get("de")).toMatch(/26\.\s*Juni\s*2026/);
  });

  it("ne recule pas d'un jour selon le fuseau", () => {
    /**
     * Le danger d'abord, sur une valeur : une date ISO est lue à minuit UTC,
     * donc un navigateur réglé à l'ouest de Greenwich affiche la VEILLE. Sur
     * une date d'entrée en vigueur, un jour d'écart n'est pas une coquetterie
     * de typographie.
     */
    const sansGarde = new Intl.DateTimeFormat("fr-FR", {
      year: "numeric", month: "long", day: "numeric", timeZone: "America/Los_Angeles",
    }).format(new Date(DATE_ENTREE_EN_VIGUEUR));
    expect(sansGarde).toMatch(/25/);

    /**
     * Et la garde, sur la SOURCE.
     *
     * `process.env.TZ` posé après le démarrage de Node ne change rien à
     * `Intl` : le fuseau est capturé une fois pour toutes. Mon premier
     * contrôle le posait et passait au vert avec la garde retirée — il ne
     * prouvait rien. On ne peut pas éprouver ce cas dans le processus
     * courant ; ce qui se vérifie, c'est que la fonction fixe son fuseau.
     */
    // PRIVÉE de ses commentaires : celui de la fonction cite `timeZone: "UTC"`
    // pour dire pourquoi il existe, et le contrôle se satisfaisait de sa
    // propre explication. Le sabotage passait au vert. C'est le piège déjà
    // payé plusieurs fois ici, dans les deux sens.
    const src = sansCommentaires(
      fs.readFileSync(path.join(__dirname, "mentionsLegales.ts"), "utf8"));
    expect(src).toMatch(/timeZone:\s*"UTC"/);
  });

  it("et les deux documents la mettent en forme au lieu de servir la constante", () => {
    // Un module juste dont personne ne vérifie le branchement ne sert à rien :
    // il suffirait de repasser `DATE_ENTREE_EN_VIGUEUR` au gabarit.
    const ecrans = [
      "app/[locale]/cgu/CguClient.tsx",
      "app/[locale]/confidentialite/ConfidentialiteClient.tsx",
    ];
    for (const rel of ecrans) {
      const src = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
      expect({ rel, formate: /versionLabel\(dateEntreeEnVigueur\(/.test(src) })
        .toEqual({ rel, formate: true });
      expect({ rel, brute: /versionLabel\(DATE_ENTREE_EN_VIGUEUR/.test(src) })
        .toEqual({ rel, brute: false });
    }
  });
});
