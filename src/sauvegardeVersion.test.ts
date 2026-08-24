import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * La sauvegarde n'avait jamais produit de sauvegarde.
 *
 * Le workflow installait `postgresql-client-16` — un numéro écrit à la main —
 * et Neon est passé en PostgreSQL 18. `pg_dump` refuse une base plus récente
 * que lui :
 *
 *     pg_dump: error: aborting because of server version mismatch
 *     pg_dump: detail: server version: 18.6 ; pg_dump version: 16.15
 *
 * L'intention était pourtant écrite en commentaire depuis le premier jour :
 * « les outils client doivent avoir la version du serveur ». C'est le numéro
 * figé qui a vieilli, pas la règle.
 *
 * Ce test garde les trois choses qui l'ont rendue muette : la version se
 * demande au serveur, le conteneur de restauration refuse bruyamment quand il
 * prend du retard, et une exécution qui n'a rien sauvegardé ne rend plus la
 * même page qu'une exécution qui a tout fait.
 */
const YAML = readFileSync(
  join(__dirname, "..", ".github", "workflows", "sauvegarde.yml"), "utf8");

describe("la sauvegarde", () => {
  it("lit le fichier attendu", () => {
    // Sans ce contrôle, un chemin devenu faux rendrait une chaîne vide et
    // tous les tests suivants passeraient en ne regardant rien.
    expect(YAML).toContain("name: Sauvegarde");
    expect(YAML).toContain("pg_dump");
  });

  it("demande la version au serveur au lieu de l'écrire à la main", () => {
    expect(YAML).toContain("SHOW server_version_num");
    expect(YAML).toContain("postgresql-client-$MAJEUR");
  });

  it("n'installe aucun client à un numéro figé", () => {
    const figes = YAML.match(/postgresql-client-\d+/g) ?? [];
    expect({ figes }).toEqual({ figes: [] });
  });

  /**
   * Le conteneur de restauration ne peut pas suivre : un service GitHub est
   * déclaré statiquement. On exige donc qu'il soit comparé à la source, et
   * que le message dise quel nombre changer.
   */
  it("refuse de tourner si la restauration ne saura pas relire le dump", () => {
    expect(YAML).toMatch(/if \[ "\$MAJEUR" -gt "\$RESTAURATION" \]/);
    expect(YAML).toMatch(/::error::.*conteneur de restauration/);
  });

  it("dit ce qu'elle a fait, même quand elle n'a rien fait", () => {
    expect(YAML).toContain("GITHUB_STEP_SUMMARY");
    expect(YAML).toContain("Aucune sauvegarde");
    expect(YAML).toContain("Sauvegarde produite");
  });

  /**
   * L'absence de secrets reste un avertissement, jamais un échec : un échec
   * quotidien se filtre, et on ne le lit plus le jour où il compte. C'est la
   * règle posée après la nuit aux cinquante courriels.
   */
  it("ne transforme pas des secrets absents en échec", () => {
    const bloc = YAML.slice(YAML.indexOf("Vérifier les secrets"), YAML.indexOf("Lire la version"));
    expect(bloc).toContain("::warning::");
    expect(bloc).not.toContain("::error::");
  });
});
