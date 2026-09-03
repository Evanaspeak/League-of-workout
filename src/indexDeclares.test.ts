import fs from "node:fs";
import path from "node:path";

/**
 * Tout index créé par une migration est déclaré dans le schéma.
 *
 * Sans ça, `prisma migrate diff` voit un écart et l'étape « Vérifier que la
 * base correspond au schéma » échoue en CI. Le prix n'est pas l'étape : c'est
 * que TOUT CE QUI SUIT est sauté — construction, parcours navigateur,
 * accessibilité. Trois versions ont été publiées ainsi, en croyant que la CI
 * jouait les parcours ; elle ne les jouait plus depuis V352.
 *
 * Le contrôle est statique, donc il tourne avec `npx jest` — c'est-à-dire
 * avant de publier, et non vingt minutes après.
 */

const MIGRATIONS = path.join(process.cwd(), "prisma", "migrations");
const SCHEMA = path.join(process.cwd(), "prisma", "schema.prisma");

/** `CREATE [UNIQUE] INDEX [IF NOT EXISTS] "nom" ON "Table"("a", "b")` */
const CREATION = /CREATE\s+(UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"\s+ON\s+"([^"]+)"\s*\(([^)]*)\)/gi;

type Index = { nom: string; table: string; colonnes: string[]; unique: boolean };

function indexDesMigrations(): Index[] {
  const trouves: Index[] = [];
  for (const dossier of fs.readdirSync(MIGRATIONS)) {
    const fichier = path.join(MIGRATIONS, dossier, "migration.sql");
    if (!fs.existsSync(fichier)) continue;
    const sql = fs.readFileSync(fichier, "utf8");
    for (const m of sql.matchAll(CREATION)) {
      trouves.push({
        unique: Boolean(m[1]),
        nom: m[2],
        table: m[3],
        colonnes: m[4].split(",").map((c) => c.trim().replace(/"/g, "")).filter(Boolean),
      });
    }
  }
  return trouves;
}

/** Les blocs `@@index([...])` et `@@unique([...])`, par modèle. */
function declaresAuSchema(): Map<string, string[][]> {
  const texte = fs.readFileSync(SCHEMA, "utf8");
  const parModele = new Map<string, string[][]>();
  const modeles = texte.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm);
  for (const m of modeles) {
    const listes: string[][] = [];
    for (const bloc of m[2].matchAll(/@@(?:index|unique)\(\[([^\]]*)\]/g)) {
      listes.push(bloc[1].split(",").map((c) => c.trim()).filter(Boolean));
    }
    // Une colonne marquée `@unique` ou `@id` porte son propre index.
    for (const champ of m[2].matchAll(/^\s*(\w+)\s+\S+.*@(?:unique|id)\b/gm)) {
      listes.push([champ[1]]);
    }
    parModele.set(m[1], listes);
  }
  return parModele;
}

/**
 * Index que Prisma ne PEUT PAS déclarer, chacun avec sa raison.
 *
 * `prisma migrate diff` les ignore aussi — c'est ce qui les rend inoffensifs
 * pour le contrôle de correspondance de la CI. Une troisième entrée devrait
 * faire vérifier que c'est toujours vrai.
 */
const HORS_SCHEMA: Record<string, string> = {
  User_email_lower_key:
    "Index FONCTIONNEL sur `lower(email)`, qui rend l'unicité insensible à la casse. "
    + "Le langage de schéma de Prisma ne sait pas exprimer une expression : il vit en SQL, "
    + "et `migrate diff` ne le voit pas non plus.",
};

describe("les index des migrations sont déclarés au schéma", () => {
  const migres = indexDesMigrations();
  const schema = declaresAuSchema();

  it("trouve bien des index : sinon il ne contrôle rien", () => {
    expect(migres.length).toBeGreaterThan(5);
    expect(schema.size).toBeGreaterThan(10);
  });

  it("chaque exemption désigne un index réel, et porte sa raison", () => {
    for (const [nom, raison] of Object.entries(HORS_SCHEMA)) {
      expect({ nom, existe: migres.some((i) => i.nom === nom) }).toEqual({ nom, existe: true });
      expect(raison.length).toBeGreaterThan(60);
    }
  });

  it("chaque index créé correspond à une déclaration du schéma", () => {
    const texte = fs.readFileSync(SCHEMA, "utf8");
    const orphelins: string[] = [];
    for (const idx of migres) {
      if (idx.nom in HORS_SCHEMA) continue;
      // Une migration qui laisse tomber l'index plus tard le retire du compte.
      if (new RegExp(`DROP\\s+INDEX\\s+(?:IF\\s+EXISTS\\s+)?"${idx.nom}"`, "i")
        .test(fs.readdirSync(MIGRATIONS)
          .map((d) => {
            const f = path.join(MIGRATIONS, d, "migration.sql");
            return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : "";
          }).join("\n"))) continue;

      const listes = schema.get(idx.table);
      if (!listes) {
        // Le modèle n'existe plus : la table a dû être supprimée depuis.
        if (!new RegExp(`model\\s+${idx.table}\\b`).test(texte)) continue;
        orphelins.push(`${idx.nom} (modèle ${idx.table} introuvable)`);
        continue;
      }
      const correspond = listes.some(
        (l) => l.length === idx.colonnes.length && l.every((c, i) => c === idx.colonnes[i]),
      );
      if (!correspond) orphelins.push(`${idx.nom} sur ${idx.table}(${idx.colonnes.join(", ")})`);
    }
    expect(orphelins).toEqual([]);
  });
});
