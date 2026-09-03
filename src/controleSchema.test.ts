import { readdirSync, readFileSync, statSync } from "node:fs";
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

/**
 * Tous les fichiers YAML sous `.github`, workflows ET actions composites.
 *
 * Il ne lisait que `.github/workflows/tests.yml`. L'étape a déménagé dans une
 * action composite le jour où quatre travaux ont eu besoin de la même
 * préparation, et les quatre contrôles sont tombés d'un coup en annonçant
 * `-1` — c'est-à-dire « je ne trouve plus ce que je garde ». C'est le bon
 * comportement, et c'est aussi le signe que le garde était accroché à un
 * CHEMIN plutôt qu'à une règle. Il suit la règle maintenant : l'étape peut
 * vivre où elle veut sous `.github`, elle doit exister quelque part.
 */
function fichiersYaml(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiersYaml(chemin);
    return /\.ya?ml$/.test(nom) ? [chemin] : [];
  });
}

function etapeControle(): string {
  const fichiers = fichiersYaml(join(__dirname, "..", ".github"));
  // Sans ce contrôle, un dossier renommé rendrait la recherche vide et le
  // garde muet — le défaut même qu'il existe pour empêcher.
  expect(fichiers.length).toBeGreaterThanOrEqual(3);

  for (const chemin of fichiers) {
    const yml = readFileSync(chemin, "utf8");
    const debut = yml.indexOf(ETAPE);
    if (debut === -1) continue;
    // L'étape s'arrête à la suivante, repérée par son tiret de liste au même
    // niveau — quelle que soit l'indentation, qui diffère entre un workflow et
    // une action composite. Borner à un nombre de lignes laisserait lire la
    // suivante.
    const suite = yml.slice(debut);
    const fin = suite.search(/\n {4,6}- /);
    return fin === -1 ? suite : suite.slice(0, fin);
  }
  throw new Error(
    `L'étape « ${ETAPE} » ne figure dans aucun fichier YAML de .github. ` +
      "Si elle a été renommée, renommer ETAPE ici ; si elle a disparu, les " +
      "migrations ne sont plus comparées au schéma.",
  );
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
