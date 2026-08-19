import { normaliserEmail, validerPseudo, PSEUDO_MAX } from "./identite";
import { estAdmin } from "./admin";

/**
 * Ces tests gardent la faille qui a valu l'escalade d'administrateur.
 *
 * Le test d'admin compare en minuscules, l'index unique de Postgres compare
 * octet par octet. Tant que l'inscription écrivait l'adresse telle quelle,
 * « EvanTocquet@… » créait une ligne distincte que `estAdmin` reconnaissait
 * ensuite. La normalisation ferme l'écart : ce fichier vérifie qu'il le reste.
 */
describe("normaliserEmail", () => {
  const ADMIN = "evantocquet@gmail.com";

  it.each([
    "EvanTocquet@gmail.com",
    "EVANTOCQUET@GMAIL.COM",
    " evantocquet@gmail.com",
    "evantocquet@gmail.com ",
    "  EvAnToCqUeT@GmAiL.CoM  ",
  ])("ramène %s à la forme que reconnaît estAdmin", (variante) => {
    const canonique = normaliserEmail(variante);
    expect(canonique).toBe(ADMIN);
    // Le point de la manœuvre : la valeur stockée entre désormais en collision
    // avec la ligne de l'administrateur, donc l'inscription est refusée.
    expect(estAdmin(canonique)).toBe(true);
  });

  it("rend null sur ce qui n'est pas une adresse", () => {
    for (const nul of [null, undefined, 42, "", "a@", "@b.com", "sans-arobase",
                       "deux@@arobases.com", "avec espace@x.com", "a@b"]) {
      expect(normaliserEmail(nul)).toBeNull();
    }
  });

  it("accepte une adresse ordinaire", () => {
    expect(normaliserEmail("Joueur.42+beta@Exemple.FR")).toBe("joueur.42+beta@exemple.fr");
  });
});

describe("validerPseudo", () => {
  it("accepte lettres, chiffres, espaces et ponctuation douce", () => {
    for (const bon of ["Evan", "joueur 42", "Zé_Ro", "a.b-c"]) {
      expect(validerPseudo(bon)).toEqual({ ok: true, valeur: bon });
    }
  });

  it("coupe les extrêmes et ce qui n'est pas du texte", () => {
    expect(validerPseudo("a").ok).toBe(false);
    expect(validerPseudo("x".repeat(PSEUDO_MAX + 1)).ok).toBe(false);
    expect(validerPseudo(null).ok).toBe(false);
    expect(validerPseudo(42).ok).toBe(false);
  });

  it("refuse le balisage, qui finissait dans un corps d'e-mail non échappé", () => {
    expect(validerPseudo("<img src=x onerror=alert(1)>").ok).toBe(false);
    expect(validerPseudo("Evan<br>").ok).toBe(false);
  });

  it("rogne les blancs plutôt que de les refuser", () => {
    expect(validerPseudo("  Evan  ")).toEqual({ ok: true, valeur: "Evan" });
  });
});
