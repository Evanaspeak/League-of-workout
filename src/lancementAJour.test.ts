import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * La liste d'avant le lancement ne réclame pas ce qui est déjà fait.
 *
 * `docs/lancement.md` est le document qu'on relit juste avant d'inviter cent
 * personnes, c'est-à-dire au moment où l'on a le moins envie de vérifier ce
 * qu'il raconte. Il a rouillé DEUX fois :
 *
 * - le 1er septembre, il réclamait les deux secrets de sauvegarde, posés
 *   depuis, et déclarait que la source OBS « n'existait pas » alors qu'elle
 *   vivait dans `src/app/(diffusion)/obs/[jeton]` ;
 * - le 9 septembre, son en-tête annonçait « deux choses à régler » quand une
 *   des deux était réglée dans son propre corps, et sa liste ordonnée
 *   réclamait encore la rotation d'un mot de passe que le corps déclarait
 *   tournée.
 *
 * Les deux fois, le défaut est le même : un COMPTE écrit une fois au-dessus de
 * quelque chose qui bouge, et un item de liste que personne ne retire quand la
 * chose est faite. Ce contrôle refuse les deux formes.
 *
 * Ce qu'il ne fait PAS, et il vaut mieux l'écrire : il ne juge pas si un
 * blocage est vrai. Rien ne peut le faire depuis ici — savoir si la clé Riot
 * de production est arrivée demande de la demander à Riot. Il tient la
 * COHÉRENCE INTERNE du document, ce qui est exactement ce qui a lâché.
 */

const doc = readFileSync(join(__dirname, "..", "docs/lancement.md"), "utf8");

/** Les titres de niveau trois, tels que le document les porte. */
function titres(): string[] {
  return [...doc.matchAll(/^### (.+)$/gm)].map((m) => m[1].trim());
}

/** Le corps d'une section de niveau trois, jusqu'au titre suivant. */
function section(titre: string): string {
  const debut = doc.indexOf(`### ${titre}`);
  if (debut < 0) throw new Error(`section introuvable : ${titre}`);
  const suite = doc.slice(debut + 4);
  const fin = suite.search(/\n#{2,3} /);
  return fin < 0 ? suite : suite.slice(0, fin);
}

describe("la liste d'avant le lancement", () => {
  it("porte au moins un titre de blocage et un titre de résolution", () => {
    const t = titres();
    // Le témoin. Sans lui, un document dont les titres auraient changé de
    // forme rendrait tous les contrôles verts en n'examinant rien — c'est la
    // façon dont meurt un garde structurel, et ce dépôt la connaît.
    expect(t.filter((x) => x.startsWith("Blocage ·")).length).toBeGreaterThan(0);
    expect(t.filter((x) => x.startsWith("Réglé")).length).toBeGreaterThan(0);
  });

  it("ne déclare pas résolu ce qu'elle annonce comme blocage", () => {
    const fautifs = titres()
      .filter((t) => t.startsWith("Blocage ·"))
      .filter((t) => /réglé|n'est plus un blocage|déjà fait|c'est fait/i.test(section(t)));
    expect(fautifs).toEqual([]);
  });

  it("n'écrit aucun COMPTE de blocages dans son en-tête", () => {
    /*
     * C'est la forme exacte qui a rouillé deux fois. Le document dit « ce qui
     * est marqué Blocage ci-dessous » : le nombre se lit dans les titres, il
     * ne s'écrit pas.
     */
    const entete = doc.slice(0, doc.indexOf("## Avant d'envoyer"));
    const motif = /\b(une|deux|trois|quatre|cinq|\d+)\s+choses?\s+à\s+régler\b/i;
    expect(motif.test(entete)).toBe(false);
  });

  it("ne réclame dans l'ordre final rien que le corps déclare fait", () => {
    /*
     * Le corps range ce qui est fait sous « n'est plus un blocage ». Un item de
     * la liste ordonnée qui reparle de la même chose est un item mort — et
     * c'est précisément ce que « le mot de passe de la base, à faire tourner »
     * était le 9 septembre, alors que la chaîne était tournée depuis une
     * semaine.
     */
    const debutOrdre = doc.indexOf("## L'ordre");
    expect(debutOrdre).toBeGreaterThan(0);
    const items = [...doc.slice(debutOrdre).matchAll(/^\d+\. (.+)$/gm)].map((m) => m[1]);
    expect(items.length).toBeGreaterThan(3);

    const iFait = doc.indexOf("Ce qui n'est plus un blocage");
    expect(iFait).toBeGreaterThan(0);
    const fait = doc.slice(iFait, debutOrdre).toLowerCase();

    /*
     * Les sujets déjà réglés, avec leurs SYNONYMES — et c'est le sabotage qui
     * l'a exigé. La première version cherchait le même mot des deux côtés :
     * elle laissait passer « le mot de passe de la base, à faire tourner »
     * parce que le corps, lui, parle de « la chaîne de connexion Neon ». Deux
     * façons de nommer la même chose, et le contrôle ne mordait pas. C'est le
     * défaut du recensement par vocabulaire, que ce journal a déjà payé : il
     * hérite du vocabulaire de celui qui l'écrit.
     */
    const regles: { quoi: string; alias: string[] }[] = [
      { quoi: "l'accès à la base", alias: ["mot de passe", "chaîne de connexion", "database_url"] },
      { quoi: "la sauvegarde", alias: ["secrets de sauvegarde", "sauvegarde de la base"] },
      { quoi: "la source de diffusion", alias: ["source obs", "surcouche obs"] },
    ];
    const fautifs: string[] = [];
    for (const item of items) {
      const bas = item.toLowerCase();
      for (const { quoi, alias } of regles) {
        const nomme = alias.some((a) => bas.includes(a));
        const declareFait = alias.some((a) => fait.includes(a));
        if (nomme && declareFait) {
          fautifs.push(`« ${item} » — le corps déclare ${quoi} fait`);
        }
      }
    }
    expect(fautifs).toEqual([]);
  });
});
