/**
 * Les migrations doivent pouvoir se rejouer.
 *
 * Deux situations, et elles ne se ressemblent pas :
 *
 *  * une base VIDE, qu'on monte de zéro — un environnement de test, une
 *    reprise après sinistre. Il faut que tout s'y crée.
 *  * la base de PRODUCTION, où presque tout existe déjà, et où une migration
 *    ajoutée après coup doit passer sans rien casser.
 *
 * Une seule écriture satisfait les deux : conditionnelle. « CREATE TABLE IF
 * NOT EXISTS », « ADD COLUMN IF NOT EXISTS », et pour les clés étrangères —
 * que PostgreSQL ne sait pas ajouter conditionnellement — soit un bloc qui
 * rattrape l'exception, soit un « DROP CONSTRAINT IF EXISTS » juste avant.
 *
 * Le dossier a vécu six semaines sans socle : aucune migration ne créait
 * « User », et `prisma migrate deploy` échouait sur une base vide en annonçant
 * « relation "User" does not exist ». Ça ne se voyait pas en production, dont
 * la base est antérieure au dossier.
 */
import fs from "node:fs";
import path from "node:path";

const DOSSIER = path.join(process.cwd(), "prisma", "migrations");

/** Le socle, qui crée ce qui existait avant que ce dossier existe. */
const SOCLE = "20260101000000_socle";

function migrations(): { nom: string; sql: string }[] {
  return fs.readdirSync(DOSSIER, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .map((nom) => ({
      nom,
      sql: fs.readFileSync(path.join(DOSSIER, nom, "migration.sql"), "utf8"),
    }));
}

/** Les commentaires ne comptent pas : on ne juge que ce qui s'exécute. */
function instructions(sql: string): string {
  return sql.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
}

describe("migrations rejouables", () => {
  const toutes = migrations();

  it("les lit bien toutes", () => {
    // Sans ce contrôle, un chemin qui cesserait de correspondre rendrait une
    // liste vide, et tout le reste passerait en ne regardant rien.
    expect(toutes.length).toBeGreaterThan(20);
    expect(toutes.every((m) => m.sql.length > 0)).toBe(true);
  });

  it("commence par le socle", () => {
    // Il doit passer AVANT celles qui ajoutent des colonnes à des tables qu'il
    // est seul à créer. L'ordre est celui des noms, d'où l'horodatage.
    expect(toutes[0].nom).toBe(SOCLE);
  });

  it("le socle crée les tables que le dossier ne créait pas", () => {
    const socle = toutes[0].sql;
    for (const table of ["User", "Game", "Goal", "Account", "Session"]) {
      expect(socle).toContain(`CREATE TABLE IF NOT EXISTS "${table}"`);
    }
  });

  it("aucune création inconditionnelle", () => {
    const fautives = toutes.filter(({ sql }) =>
      /^\s*CREATE (TABLE|INDEX|UNIQUE INDEX) "/m.test(instructions(sql)));
    expect(fautives.map((m) => m.nom)).toEqual([]);
  });

  it("aucun ajout de colonne inconditionnel", () => {
    const fautives = toutes.filter(({ sql }) =>
      /ADD COLUMN (?!IF NOT EXISTS)/.test(instructions(sql)));
    expect(fautives.map((m) => m.nom)).toEqual([]);
  });

  it("chaque clé étrangère sait qu'elle existe peut-être déjà", () => {
    // PostgreSQL n'a pas d'« ADD CONSTRAINT IF NOT EXISTS » : il faut donc
    // rattraper l'exception, ou retirer la contrainte juste avant.
    const fautives = toutes.filter(({ sql }) => {
      const texte = instructions(sql);
      if (!/ADD CONSTRAINT/.test(texte)) return false;
      return !/duplicate_object/.test(texte) && !/DROP CONSTRAINT IF EXISTS/.test(texte);
    });
    expect(fautives.map((m) => m.nom)).toEqual([]);
  });
});
