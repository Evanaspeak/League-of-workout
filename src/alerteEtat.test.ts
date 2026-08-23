/**
 * L'alerte ne doit crier qu'au changement d'état.
 *
 * Un travail programmé qui échoue à chaque exécution envoie un courriel à
 * chaque exécution. La supervision tourne toutes les quinze minutes : une
 * panne d'une nuit, c'est trente-deux courriels identiques, et le trente et
 * unième ne dit rien de plus que le premier. C'est arrivé — cinquante
 * courriels en une nuit pour un seul travail cassé — et la conséquence n'est
 * pas l'agacement, c'est que l'alerte devienne quelque chose qu'on filtre.
 *
 * La décision vit dans un script à part, `.github/alerte-etat.sh`, précisément
 * pour être éprouvable ici : une logique d'alerte qu'on ne peut pas faire
 * échouer sur commande n'est pas une logique d'alerte.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const SCRIPT = path.join(process.cwd(), ".github", "alerte-etat.sh");
const QUART = 900;
const DEPART = 1_000_000_000;

/** Un fichier d'état neuf, propre à chaque scénario. */
function etatNeuf(): string {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "alerte-")), "etat.env");
}

function sonder(sain: "oui" | "non", fichier: string, instant: number): string[] {
  return execFileSync("sh", [SCRIPT, sain, fichier, String(instant)], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean);
}

/** Nombre de cris sur une suite de sondes espacées d'un quart d'heure. */
function cris(sains: ("oui" | "non")[], fichier = etatNeuf()): number {
  return sains.reduce((total, sain, i) => (
    total + (sonder(sain, fichier, DEPART + i * QUART).at(-1) === "crier" ? 1 : 0)
  ), 0);
}

const enPanne = (n: number) => Array<"non">(n).fill("non");

describe("alerte de supervision", () => {
  it("ne dit rien quand le site est debout", () => {
    expect(cris(Array<"oui">(96).fill("oui"))).toBe(0);
  });

  it("crie une fois, pas vingt-quatre, sur une panne de six heures", () => {
    expect(cris(enPanne(24))).toBe(1);
  });

  it("rappelle une fois par jour tant que la panne dure", () => {
    // Une première alerte peut se perdre, et trois jours de silence ne se
    // distinguent pas d'un site debout.
    expect(cris(enPanne(288))).toBe(3);
  });

  it("recrie après un retour à la normale", () => {
    // Sans ça, un incident réglé puis reproduit passerait inaperçu.
    const f = etatNeuf();
    expect(sonder("non", f, DEPART).at(-1)).toBe("crier");
    expect(sonder("oui", f, DEPART + QUART)).toContain("revenu");
    expect(sonder("non", f, DEPART + 2 * QUART).at(-1)).toBe("crier");
  });

  it("sans mémoire, retombe dans le travers qu'il corrige", () => {
    // Le sabotage du contrôle : si l'état ne se conserve pas d'une sonde à
    // l'autre, chaque échec redevient un premier échec. C'est exactement le
    // comportement d'avant, et c'est ce qui arrive si le cache de GitHub est
    // évincé — dégradation acceptable, mais qu'il vaut mieux avoir écrite.
    let total = 0;
    for (let i = 0; i < 24; i++) {
      if (sonder("non", etatNeuf(), DEPART + i * QUART).at(-1) === "crier") total += 1;
    }
    expect(total).toBe(24);
  });
});
