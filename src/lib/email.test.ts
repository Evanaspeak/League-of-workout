/**
 * Ce qui part par courriel, une fois échappé.
 *
 * Le module s'éprouve avec sa vraie dépendance doublée : `Resend` est
 * instancié au chargement, à partir de la variable d'environnement, donc la
 * clé doit exister AVANT l'import — sans quoi `resend` vaut `null` et les
 * deux fonctions rendent la main sans rien envoyer.
 */

const envoyer = jest.fn().mockResolvedValue({});
jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: envoyer } })),
}));

process.env.RESEND_API_KEY = "cle-de-test";

import { courrielConfigure, envoyerBilanHebdo, sendResetLink } from "./email";
import { textesBilan } from "./i18n/courriels";

// Les vrais textes, plutôt qu'une doublure : c'est ce qui part réellement, et
// une doublure de dictionnaire dérive du jour où une clé s'ajoute.
const TEXTES = textesBilan("fr");

const BILAN = {
  parties: 3, victoires: 2, defaites: 1,
  pointsDus: 40, pointsPayes: 25, joursActifs: 2,
};

function dernierHtml(): string {
  return envoyer.mock.calls[envoyer.mock.calls.length - 1][0].html as string;
}

beforeEach(() => envoyer.mockClear());

describe("courriels", () => {
  it("se déclare configuré quand la clé est là", () => {
    expect(courrielConfigure()).toBe(true);
  });

  it("échappe le pseudo du lien de récupération", async () => {
    await sendResetLink("qui@example.test", 'Jo <img src=x onerror="1">', "https://exemple.test/x");
    const html = dernierHtml();
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("échappe le pseudo du bilan hebdomadaire", async () => {
    await envoyerBilanHebdo("qui@example.test", "<script>", TEXTES, BILAN, false);
    const html = dernierHtml();
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("ne l'échappe qu'une fois", async () => {
    // Le pseudo était échappé, puis le texte qui le porte l'était à son tour :
    // « A & B » devenait « A &amp;amp; B », donc « A &amp; B » à l'écran. Le
    // jeu de caractères autorisé pour un pseudo n'en contient aucun
    // aujourd'hui, ce qui rendait le défaut invisible — et vide de son sens la
    // seule raison d'être de l'échappement, qui est de tenir le jour où un
    // autre chemin d'écriture oubliera la règle.
    await envoyerBilanHebdo("qui@example.test", "A & B", TEXTES, BILAN, false);
    const html = dernierHtml();
    expect(html).toContain("Ta semaine, A &amp; B");
    expect(html).not.toContain("&amp;amp;");
  });

  it("n'envoie rien à personne d'autre que le destinataire demandé", async () => {
    await envoyerBilanHebdo("qui@example.test", "Joueur", TEXTES, BILAN, true);
    expect(envoyer.mock.calls[0][0].to).toBe("qui@example.test");
  });
});
