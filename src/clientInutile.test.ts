import fs from "node:fs";
import path from "node:path";

/**
 * `useT` seul ne justifie pas d'être un composant client.
 *
 * Un composant marqué `"use client"` emporte dans le paquet JavaScript tout ce
 * qu'il importe — dictionnaires compris, dans les six langues. Or plusieurs ne
 * l'étaient QUE pour appeler `useT` : aucun état, aucun gestionnaire, aucune
 * lecture du navigateur. Leur texte ne bouge jamais et le serveur sait le
 * rendre entièrement.
 *
 * Cinq d'entre eux — CGU, confidentialité, connexion, téléchargement, en-tête
 * d'administration — pesaient **37 ko compressés**, soit 5,6 % de tout le
 * JavaScript du site. Mesuré en pesant les fragments avant et après.
 *
 * `textes(dict, locale)` fait au serveur ce que `useT` fait au navigateur. Ce
 * n'était possible qu'une fois la langue dans l'adresse : c'est le bénéfice
 * différé de ce chantier-là, et il ne s'est pas encaissé tout seul.
 */

/** Ce qui a réellement besoin du navigateur. */
const BESOIN_CLIENT = /use(State|Effect|Ref|Memo|Callback|Context|Router|SearchParams|Params|Pathname|SyncExternalStore|Chemin|Locale|Session|Minuscule|DateLocale|ValeurClient|ContexteConnecte|Champions|IdCompte|Compte|RequeteMedia|MouvementReduit|PiegeFocus)\b/;
const GESTIONNAIRE = /\bon[A-Z]\w+=/;
const NAVIGATEUR = /\b(window|document|localStorage|sessionStorage|navigator)\b/;

function fichiersTsx(racine: string): string[] {
  const sortie: string[] = [];
  for (const e of fs.readdirSync(racine, { withFileTypes: true })) {
    const complet = path.join(racine, e.name);
    if (e.isDirectory()) sortie.push(...fichiersTsx(complet));
    else if (e.name.endsWith(".tsx")) sortie.push(complet);
  }
  return sortie;
}

describe("les composants clients", () => {
  const racine = path.join(process.cwd(), "src");
  const clients = fichiersTsx(racine)
    .map((f) => ({ chemin: path.relative(racine, f), texte: fs.readFileSync(f, "utf8") }))
    .filter(({ texte }) => texte.startsWith('"use client"'));

  it("sont bien trouvés", () => {
    // Un motif qui cesserait de correspondre rendrait une liste vide, et le
    // test suivant passerait en ne regardant rien.
    expect(clients.length).toBeGreaterThan(20);
  });

  it("le sont pour autre chose que useT", () => {
    const inutiles = clients
      .filter(({ texte }) => texte.includes("useT"))
      .filter(({ texte }) => {
        // `useT` est retiré avant l'examen : c'est justement ce qu'on ne veut
        // pas accepter comme justification.
        const corps = texte.replace(/\buseT\b/g, "");
        return !BESOIN_CLIENT.test(corps)
          && !GESTIONNAIRE.test(corps)
          && !NAVIGATEUR.test(corps);
      })
      .map(({ chemin }) => chemin);
    expect(inutiles).toEqual([]);
  });
});
