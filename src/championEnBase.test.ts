import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { sansCommentaires } from "@/test/sansCommentaires";

/**
 * Le nom du champion qui entre en base se résout, et il se résout PARTOUT.
 *
 * `Game.champion` est la clé de trois choses — l'icône de Data Dragon, le
 * REGROUPEMENT de maîtrise, et ce que l'historique affiche — donc deux
 * orthographes du même champion en base font deux champions.
 *
 * Ce garde est né d'une correction qui n'en réparait qu'une moitié : la porte
 * d'enregistrement s'est mise à normaliser, l'APERÇU non. Les deux comptent la
 * maîtrise, donc les deux se sont mis à compter sur deux champions différents,
 * et l'aperçu annonçait un coût que l'enregistrement n'allait pas calculer.
 * Le commentaire de l'aperçu promettait pourtant « le même filtre que dans
 * /api/games » — une garantie décrite qui avait cessé d'être vraie.
 *
 * Il regarde le DOSSIER plutôt qu'une liste écrite à la main : ce qui compte
 * n'est pas les deux routes d'aujourd'hui, c'est la troisième qu'on ajoutera.
 *
 * Le source est lu PRIVÉ DE SES COMMENTAIRES, et il faut dire exactement ce
 * que ça vaut : **aucun verdict ne change aujourd'hui** — mesuré en le
 * débranchant, les quatre contrôles restent verts. Ce qu'il tient est le sens
 * FAUX POSITIF : l'un des `data:` de `/api/games` porte le mot « champion »
 * dans une phrase qui explique qu'une séance au temps n'en a pas, et une route
 * de LECTURE dont un commentaire dessinerait un `where` se ferait accuser de
 * ne pas résoudre ce qu'elle n'écrit pas. Un garde qui crie sur ce qui va bien
 * finit par ne plus se lire.
 */

const API = join(process.cwd(), "src/app/api");

function fichiersApi(): string[] {
  const out: string[] = [];
  (function marcher(d: string) {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) marcher(p);
      else if (/\.tsx?$/.test(e) && !e.includes(".test.")) out.push(p);
    }
  })(API);
  return out;
}

/**
 * Les objets `where:` et `data:`, extraits en suivant la PROFONDEUR des
 * accolades. Un découpage sur les virgules ou sur la fin de ligne raterait
 * tout objet écrit sur plusieurs lignes — c'est-à-dire tous ceux d'ici.
 */
function objets(src: string, cle: "where" | "data"): string[] {
  const out: string[] = [];
  const motif = new RegExp(`\\b${cle}\\s*:\\s*\\{`, "g");
  let m: RegExpExecArray | null;
  while ((m = motif.exec(src))) {
    let i = m.index + m[0].length;
    let prof = 1;
    while (i < src.length && prof > 0) {
      if (src[i] === "{") prof++;
      else if (src[i] === "}") prof--;
      i++;
    }
    out.push(src.slice(m.index, i));
  }
  return out;
}

/** Les fichiers qui FILTRENT ou ÉCRIVENT sur la colonne, jamais ceux qui la lisent. */
function sitesDecrivainsEtDeFiltre(): { fichier: string; site: string }[] {
  const out: { fichier: string; site: string }[] = [];
  for (const f of fichiersApi()) {
    const src = sansCommentaires(readFileSync(f, "utf8"));
    for (const cle of ["where", "data"] as const) {
      for (const o of objets(src, cle)) {
        if (/\bchampion\b/.test(o)) out.push({ fichier: f, site: o });
      }
    }
  }
  return out;
}

describe("le nom du champion qui entre en base", () => {
  it("est résolu par toute route qui filtre ou écrit dessus", () => {
    const fautifs = sitesDecrivainsEtDeFiltre()
      .filter(({ fichier }) => !/championEnregistre\s*\(/.test(readFileSync(fichier, "utf8")))
      .map(({ fichier, site }) => `${fichier.replace(API, "api")} → ${site.replace(/\s+/g, " ").slice(0, 80)}`);
    expect(fautifs).toEqual([]);
  });

  it("ne vient jamais du corps de la requête sans passer par la résolution", () => {
    // `body.champion` employé comme VALEUR est le défaut d'origine. Le test de
    // PRÉSENCE — `capacites.champions && body.champion` — est légitime et
    // reconnaissable : il n'entre dans aucun appel ni aucune affectation.
    const fautifs: string[] = [];
    for (const f of fichiersApi()) {
      const src = sansCommentaires(readFileSync(f, "utf8"));
      const motif = /body\s*(?:\.champion\b|\[\s*["']champion["']\s*\])/g;
      let m: RegExpExecArray | null;
      while ((m = motif.exec(src))) {
        const avant = src.slice(Math.max(0, m.index - 120), m.index);
        const testDePresence = /&&\s*$/.test(avant);
        const dansLaResolution = /championEnregistre\s*\(\s*(?:String\s*\(\s*)?$/.test(avant);
        if (!testDePresence && !dansLaResolution) {
          fautifs.push(`${f.replace(API, "api")} → …${avant.slice(-50).replace(/\s+/g, " ")}${m[0]}`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });

  /**
   * Le témoin. Un dossier renommé, un motif devenu aveugle ou un découpage
   * cassé rendraient les deux contrôles verts en n'examinant rien —
   * `toEqual([])` est vrai sur une liste vide, et rien ne distingue « rien à
   * signaler » de « rien regardé ».
   */
  it("a bien quelque chose à examiner", () => {
    expect(fichiersApi().length).toBeGreaterThan(40);
    expect(sitesDecrivainsEtDeFiltre().length).toBeGreaterThanOrEqual(4);
  });

  /**
   * Le DÉCOUPAGE s'éprouve à part, sur des cas fabriqués.
   *
   * L'état sain du dépôt est zéro trouvaille : les fichiers réels ne
   * distinguent donc pas un extracteur juste d'un extracteur qui rendrait
   * toujours vide, ni d'un extracteur qui déborde sur l'objet suivant.
   */
  it("découpe les objets sur la profondeur des accolades", () => {
    const src = `
      prisma.game.count({ where: { userId: u, sansEnjeu: false, champion } });
      prisma.game.findMany({ select: { champion: true }, where: { userId: u } });
    `;
    const trouves = objets(src, "where");
    expect(trouves).toHaveLength(2);
    expect(trouves[0]).toContain("champion");
    // Le second `where` ne porte pas la colonne : un extracteur qui déborderait
    // sur le `select` voisin le croirait, et le garde crierait sur une lecture.
    expect(/\bchampion\b/.test(trouves[1])).toBe(false);

    // Un objet imbriqué ne referme pas celui du dessus.
    const imbrique = objets(`where: { a: { b: 1 }, champion }`, "where");
    expect(imbrique).toHaveLength(1);
    expect(imbrique[0]).toContain("champion");
  });
});
