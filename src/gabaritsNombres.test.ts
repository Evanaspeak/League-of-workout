import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { settings } from "@/lib/i18n/dictionaries/settings";
import { dashboard } from "@/lib/i18n/dictionaries/dashboard";
import { history } from "@/lib/i18n/dictionaries/history";
import { testPompes } from "@/lib/i18n/dictionaries/testPompes";
import { calculateur } from "@/lib/i18n/dictionaries/calculateur";
import { amis } from "@/lib/i18n/dictionaries/amis";
import { argumentsDe } from "./quantiteLocalisee.test";

/**
 * Les gabarits qui reçoivent un nombre POUVANT dépasser le millier.
 *
 * Le bloc français des dictionnaires porte soixante-dix-neuf gabarits à
 * paramètre numérique. La plupart ne dépassent jamais mille — des seuils, des
 * rangs, des compteurs de jours, des paliers bornés à cinq cents — et les
 * reprendre tous ferait une liste d'exemptions que personne ne tiendrait à
 * jour. Quatre ne sont pas dans ce cas, et ils reçoivent désormais le nombre
 * DÉJÀ mis en forme :
 *
 * - l'objectif et le maintien caloriques, qui sont TOUJOURS à quatre chiffres ;
 * - les minutes de marche équivalentes, qui les dépassent sur une grosse
 *   dette ;
 * - le compte de parties de l'historique — le propriétaire en est à neuf cent
 *   soixante, donc le millier n'est pas une hypothèse.
 *
 * Ce test porte sur les VALEURS et pas sur la signature : un `string` qu'on
 * remplirait avec `String(n)` satisfait le type et rend « 2207 ».
 */

const LANGUES = ["fr", "en", "es", "de", "zh", "ja"] as const;

describe("les gabarits qui reçoivent un grand nombre", () => {
  it("affichent le nombre tel qu'on le leur donne, sans le reconvertir", () => {
    // On leur passe un nombre DÉJÀ groupé : s'ils le reformataient ou le
    // tronquaient, il ne ressortirait pas tel quel.
    for (const l of LANGUES) {
      expect(settings[l].corpsObjectifValeur("2 207")).toContain("2 207");
      expect(settings[l].corpsMaintienValeur("2 207")).toContain("2 207");
      expect(dashboard[l].energieSub("1 020")).toContain("1 020");
      expect(history[l].activitesAndTotal("1 240", 1240, "x")).toContain("1 240");
      /**
       * Le cinquième, manqué par le recensement de la veille : le mur des
       * records. Il porte le plus gros JOUR d'effort, donc il est par
       * définition celui qui atteint les grands nombres — et il interpolait
       * un `number` brut, ce qui rendait « 12000 » dans les six langues.
       */
      expect(amis[l].recordsLigne("Kayn", "12 000", "4 sept.")).toContain("12 000");
    }
  });

  it("laissent la DÉCIMALE au format qu'on leur donne", () => {
    /**
     * L'autre moitié du sujet, et la plus dangereuse. `${n}` rend « 24.7 »
     * dans les six langues ; le français et l'espagnol écrivent « 24,7 », et
     * en allemand le POINT est le séparateur des MILLIERS — « 24.7 » s'y lit
     * comme vingt-quatre mille sept. Ce n'est pas de la typographie, c'est un
     * chiffre faux, et il s'agit ici de l'IMC, du poids, de la masse grasse et
     * du multiplicateur de dette.
     */
    for (const l of LANGUES) {
      expect(settings[l].corpsImc("24,7")).toContain("24,7");
      expect(settings[l].corpsPeseeValeur("78,4")).toContain("78,4");
      expect(settings[l].corpsMasseGrasse("18,3")).toContain("18,3");
      expect(calculateur[l].multiplicateur("1,8")).toContain("1,8");
      expect(testPompes[l].resume(3, "1,8")).toContain("1,8");
      expect(testPompes[l].apercu(3, "1,8")).toContain("1,8");
    }
  });

  it("gardent l'accord au pluriel sur le COMPTE, pas sur la chaîne", () => {
    /**
     * Le gabarit reçoit deux choses, et les noms les distinguent : `formate`
     * pour l'afficher, `n` pour accorder. Sans le second, on ne pourrait plus
     * accorder du tout — c'est la leçon de l'effort du classement, où la même
     * séparation avait été faite pour la même raison.
     */
    expect(history.fr.activitesAndTotal("1", 1, "x")).toContain("1 partie ");
    expect(history.fr.activitesAndTotal("2", 2, "x")).toContain("2 parties ");
    expect(history.en.activitesAndTotal("1", 1, "x")).toContain("1 game ");
    expect(history.en.activitesAndTotal("2", 2, "x")).toContain("2 games ");
    /**
     * Et le cas qui DISTINGUE, sans lequel les quatre au-dessus ne prouvent
     * rien : un nombre groupé. Accorder sur la chaîne donne `Number("1 240")`,
     * c'est-à-dire `NaN`, donc le singulier — sur le compte de quelqu'un qui a
     * mille deux cent quarante parties. Mes premiers cas passaient tous avec ce
     * sabotage en place, et c'est lui qui l'a dit.
     */
    expect(history.fr.activitesAndTotal("1 240", 1240, "x")).toContain("1 240 parties ");
    expect(history.de.activitesAndTotal("1.240", 1240, "x")).toContain("1.240 Partien ");
  });

  it("sont appelés avec un nombre MIS EN FORME, jamais avec un brut", () => {
    /**
     * Le contrôle qui manquait, et c'est la troisième fois cette nuit que le
     * même trou apparaît : un dictionnaire juste dont personne ne vérifie
     * l'APPEL ne sert à rien. Le sabotage qui remplace `decimal(x)` par
     * `String(x)` satisfait le type — c'est bien une chaîne — et rend « 24.7 »
     * en allemand.
     *
     * On regarde donc l'argument passé, et il doit venir d'un formateur.
     */
    /**
     * La clé, et le RANG de l'argument qui s'affiche. Il valait zéro partout
     * jusqu'à ce que le mur des records entre dans la liste : sa ligne
     * commence par un pseudo, et le nombre vient en second. Une liste de clés
     * sans rang aurait déclaré son appel fautif — un garde qui crie sur ce
     * qui va bien finit par ne plus se lire.
     */
    const CLES: Record<string, number> = {
      corpsImc: 0, corpsPeseeValeur: 0, corpsMasseGrasse: 0, multiplicateur: 0,
      corpsObjectifValeur: 0, corpsMaintienValeur: 0, energieSub: 0,
      activitesAndTotal: 0, recordsLigne: 1,
    };
    const fautifs: string[] = [];
    let appels = 0;
    const SRC = join(process.cwd(), "src");
    const lister = (d: string, out: string[] = []): string[] => {
      for (const e of readdirSync(d, { withFileTypes: true })) {
        if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "generated") continue;
        const c = join(d, e.name);
        if (e.isDirectory()) lister(c, out);
        else if (e.name.endsWith(".tsx") && !e.name.includes(".test.")) out.push(c);
      }
      return out;
    };
    for (const f of lister(SRC)) {
      const texte = readFileSync(f, "utf8");
      for (const [cle, rang] of Object.entries(CLES)) {
        /**
         * Le découpage suit la PROFONDEUR des parenthèses, il ne coupe pas
         * sur les virgules. La ligne du mur porte deux appels imbriqués —
         * `recordsLigne(r.pseudo, nombre(r.points), jourLisible(r.jour))` —
         * et un découpage naïf y compterait cinq arguments au lieu de trois.
         * C'est la fonction de `quantiteLocalisee.test.ts`, éprouvée là-bas
         * sur des cas fabriqués.
         */
        for (const m of texte.matchAll(new RegExp(`\\.${cle}\\(`, "g"))) {
          const args = argumentsDe(texte, m.index + m[0].length - 1);
          if (!args) continue;
          appels += 1;
          const affiche = args[rang] ?? "";
          if (!/\b(decimal|nombre)\s*\(/.test(affiche)) {
            fautifs.push(`${f.slice(SRC.length + 1)} → ${cle}(…${affiche.slice(0, 40)})`);
          }
        }
      }
    }
    // Témoin : sans lui, un motif devenu aveugle rendrait le contrôle vert.
    expect(appels).toBeGreaterThanOrEqual(8);
    expect(fautifs).toEqual([]);
  });

  it("recense encore les gabarits numériques, pour que la question se repose", () => {
    /**
     * Le témoin, et il ne garde pas une valeur : il garde que le RECENSEMENT
     * trouve encore quelque chose. Le jour où ce compte bouge beaucoup, c'est
     * qu'une famille de gabarits est apparue ou a disparu, et la question
     * « celui-là peut-il dépasser mille ? » se repose.
     */
    const DICOS = join(process.cwd(), "src", "lib", "i18n", "dictionaries");
    let numeriques = 0;
    for (const f of readdirSync(DICOS).filter((x) => x.endsWith(".ts"))) {
      const src = readFileSync(join(DICOS, f), "utf8");
      const debut = src.indexOf("  fr: {");
      if (debut === -1) continue;
      const fin = src.indexOf("  en: {", debut);
      const bloc = src.slice(debut, fin === -1 ? src.length : fin);
      for (const m of bloc.matchAll(/^ {4}\w+:\s*\(([^)]*)\)\s*=>/gm)) {
        if (/:\s*number/.test(m[1])) numeriques += 1;
      }
    }
    expect(numeriques).toBeGreaterThan(60);
    expect(numeriques).toBeLessThan(100);
  });
});
