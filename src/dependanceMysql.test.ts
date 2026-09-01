import fs from "node:fs";
import path from "node:path";

/**
 * Pourquoi deux vulnérabilités hautes restent en place, et ce qui le justifie.
 *
 * `npm audit` signale `mysql2 < 3.22.0` — « Auth Plugin Downgrade to
 * mysql_clear_password Leaks Plaintext Credentials ». Elle décrit un CLIENT
 * MySQL qu'un serveur MySQL malveillant convainc de repasser en mot de passe
 * en clair. Il faut donc, pour l'atteindre, ouvrir une connexion MySQL.
 *
 * Ce projet parle à PostgreSQL. `mysql2` n'arrive que comme dépendance de la
 * ligne de commande `prisma`, qui embarque un pilote par base gérée, et aucune
 * ligne de code ne l'appelle. La faille est présente et inatteignable.
 *
 * Elle ne se corrige pas non plus : `prisma@7.10.0`, la dernière de la branche,
 * épingle toujours `mysql2@3.15.3`, et le seul « correctif » que propose npm
 * est de REVENIR à `prisma@6.19.3` — un retour de version majeure, sur le
 * client d'accès aux données, pour une faille qu'on ne peut pas atteindre.
 * Le remède serait plus dangereux que le mal.
 *
 * Ce test existe pour que ce raisonnement cesse d'être vrai en silence. Il
 * tient à deux conditions ; le jour où l'une tombe, l'exemption tombe avec.
 */
describe("la faille mysql2 reste hors d'atteinte", () => {
  const racine = process.cwd();

  it("la base est PostgreSQL, pas MySQL", () => {
    const schema = fs.readFileSync(path.join(racine, "prisma", "schema.prisma"), "utf8");
    const datasource = schema.slice(schema.indexOf("datasource"), schema.indexOf("generator") + 200);
    expect(datasource).toMatch(/provider\s*=\s*"postgresql"/);
    expect(schema).not.toMatch(/provider\s*=\s*"mysql"/);
  });

  it("aucun code ne charge un pilote MySQL", () => {
    const fichiers: string[] = [];
    const parcourir = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const complet = path.join(d, e.name);
        if (e.isDirectory()) { if (e.name !== "generated") parcourir(complet); }
        else if (/\.(ts|tsx|js|mjs)$/.test(e.name) && !e.name.endsWith(".test.ts")) {
          fichiers.push(complet);
        }
      }
    };
    for (const base of ["src", "desktop/src", "scripts"]) {
      const chemin = path.join(racine, base);
      if (fs.existsSync(chemin)) parcourir(chemin);
    }
    // Un dossier renommé rendrait le test vert sur zéro fichier lu.
    expect(fichiers.length).toBeGreaterThan(50);

    const coupables = fichiers.filter((f) =>
      /["']mysql2?["']|@prisma\/adapter-mysql/.test(fs.readFileSync(f, "utf8")));
    expect(coupables.map((f) => path.relative(racine, f))).toEqual([]);
  });
});
