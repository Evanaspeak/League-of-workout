import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Le contrôle qui vérifie que les migrations reconstruisent bien le schéma.
 *
 * Il a passé plusieurs versions au vert sans rien vérifier. Il était écrit
 * `prisma migrate diff --from-url … --script | grep … || true` : `--from-url`
 * a été retiré de Prisma 7, la commande sortait en erreur sur la sortie
 * d'erreur, `grep` ne recevait rien, l'écart était vide, l'étape passait.
 *
 * Le défaut n'a aucune chance de se voir : une étape verte ressemble à une
 * étape qui a travaillé. Ce test regarde donc les trois choses qui l'ont fait
 * mentir, plutôt que d'attendre qu'un humain relise le fichier.
 */
const ETAPE = "Vérifier que la base correspond au schéma";

function etapeControle(): string {
  const yml = readFileSync(join(__dirname, "..", ".github", "workflows", "tests.yml"), "utf8");
  const debut = yml.indexOf(ETAPE);
  expect(debut).toBeGreaterThanOrEqual(0);
  // L'étape s'arrête à la suivante, repérée par son tiret de liste au même
  // niveau. Borner à un nombre de lignes laisserait lire la suivante.
  const suite = yml.slice(debut);
  const fin = suite.indexOf("\n      - ");
  return fin === -1 ? suite : suite.slice(0, fin);
}

describe("le contrôle de schéma en intégration continue", () => {
  test("l'étape existe et appelle bien la comparaison", () => {
    // Sans ce contrôle, une étape renommée rendrait tous les autres vides.
    expect(etapeControle()).toContain("prisma migrate diff");
  });

  test("il distingue « identique », « différent » et « en panne »", () => {
    // Sans `--exit-code`, la sortie vide d'une commande en panne est
    // indiscernable d'une base conforme.
    expect(etapeControle()).toContain("--exit-code");
  });

  test("il n'emploie pas une option retirée de Prisma 7", () => {
    expect(etapeControle()).not.toContain("--from-url");
  });

  test("il n'avale pas son propre échec", () => {
    // `|| true` sur la commande dont on lit la sortie transforme n'importe
    // quelle panne en succès silencieux. C'est exactement ce qui s'est passé.
    expect(etapeControle()).not.toContain("|| true");
  });
});
