import manifest from "@/app/manifest";
import { DEPART_TELEPHONE, PARAM_AJOUT, ouvrirSurAjout, type EtatOuverture } from "./ouvertureTelephone";

const SAIN: EtatOuverture = {
  demande: true,
  telephone: true,
  fenetreOuverte: false,
  introFaite: true,
};

describe("l'ouverture sur l'ajout de partie", () => {
  it("ouvre quand l'application vient d'être lancée sur un téléphone", () => {
    expect(ouvrirSurAjout(SAIN)).toBe(true);
  });

  it("n'ouvre pas sur une navigation ordinaire", () => {
    /**
     * C'est la condition qui rend le reste supportable : sans elle, revenir de
     * l'historique au tableau de bord ferait apparaître un formulaire que
     * personne n'a demandé. Le paramètre ne vient que du manifeste.
     */
    expect(ouvrirSurAjout({ ...SAIN, demande: false })).toBe(false);
  });

  it("n'ouvre pas sur un pointeur fin", () => {
    // Le manifeste sert aussi aux installations de bureau, où la réponse 210
    // ne dit rien — et où le rail est déplié, donc le geste est déjà là.
    expect(ouvrirSurAjout({ ...SAIN, telephone: false })).toBe(false);
  });

  it("n'ouvre pas par-dessus une fenêtre déjà ouverte", () => {
    // Deux modales empilées : la seconde recouvre la première et rien ne se
    // clique derrière. Le journal l'a payé trois fois.
    expect(ouvrirSurAjout({ ...SAIN, fenetreOuverte: true })).toBe(false);
  });

  it("n'ouvre pas tant que l'intro du compte n'est pas passée", () => {
    /**
     * La visite guidée NAVIGUE d'une page à l'autre, et elle démarre quelques
     * secondes après le chargement — donc après le moment où l'on regarde le
     * document. Le contrôle de fenêtre ne peut pas la voir.
     */
    expect(ouvrirSurAjout({ ...SAIN, introFaite: false })).toBe(false);
  });
});

describe("et le manifeste est ce qui la déclenche", () => {
  it("porte le paramètre dans son adresse de départ", () => {
    /**
     * Les deux moitiés se tiennent : le tableau de bord peut lire le paramètre
     * aussi bien qu'il veut, si le manifeste cesse de le poser, plus personne
     * ne l'ouvre jamais — sans erreur et sans test rouge. C'est le trou que ce
     * projet paie en boucle, et il vaut un contrôle sur la VALEUR rendue.
     */
    const m = manifest();
    expect(m.start_url).toBe(DEPART_TELEPHONE);
    expect(new URL(m.start_url!, "https://exemple.test").searchParams.has(PARAM_AJOUT)).toBe(true);
  });

  it("part toujours du tableau de bord, sans préfixe de langue", () => {
    // Un manifeste pour six langues : le middleware négocie. Y figer une
    // langue en donnerait la mauvaise à cinq personnes sur six.
    const u = new URL(manifest().start_url!, "https://exemple.test");
    expect(u.pathname).toBe("/dashboard");
  });
});
