const { ATTENTE_MS, attenteCourante, nonceValide } = require("./attenteAuth");

/**
 * Le canal de connexion de l'application de bureau.
 *
 * Sans cet aléa, n'importe quoi tournant sur la machine pourrait pousser une
 * session dans l'application. Il n'avait aucun test : il vivait dans
 * `main.js`, mille cinq cents lignes qu'on n'éprouve qu'avec Electron ouvert.
 */
const T = 1_000_000;

describe("l'attente d'authentification", () => {
  it("garde celle en cours tant qu'elle vaut", () => {
    // Deux chemins mènent à l'ouverture pour une seule intention de connexion.
    // En forger un second écraserait le premier, et le retour serait refusé.
    const a = attenteCourante(null, T);
    expect(attenteCourante(a, T + 1000)).toBe(a);
  });

  it("en forge une neuve quand la précédente a expiré", () => {
    const a = attenteCourante(null, T);
    const b = attenteCourante(a, T + ATTENTE_MS + 1);
    expect(b).not.toBe(a);
    expect(b.nonce).not.toBe(a.nonce);
  });

  it("dure quinze minutes, pas cinq", () => {
    // Choisir un compte, taper un mot de passe et passer une double
    // authentification dépasse couramment cinq minutes.
    expect(ATTENTE_MS).toBe(15 * 60 * 1000);
  });

  it("forge un aléa qui ne se devine pas", () => {
    const vus = new Set();
    for (let i = 0; i < 50; i++) vus.add(attenteCourante(null, T).nonce);
    expect(vus.size).toBe(50);
    // 32 octets en base64url : quarante-trois caractères.
    expect([...vus][0]).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("la validation de l'aléa", () => {
  const attente = { nonce: "a".repeat(43), expire: T + 1000 };

  it("accepte le bon, en temps voulu", () => {
    expect(nonceValide(attente, "a".repeat(43), T)).toBe(true);
  });

  it("refuse quand il n'y a aucune attente", () => {
    expect(nonceValide(null, "a".repeat(43), T)).toBe(false);
    expect(nonceValide(undefined, "a".repeat(43), T)).toBe(false);
  });

  it("refuse une attente expirée", () => {
    expect(nonceValide(attente, "a".repeat(43), T + 2000)).toBe(false);
  });

  it("refuse un aléa faux de la bonne longueur", () => {
    expect(nonceValide(attente, "b".repeat(43), T)).toBe(false);
    expect(nonceValide(attente, "a".repeat(42) + "b", T)).toBe(false);
  });

  it("refuse une longueur différente sans lever", () => {
    /**
     * `timingSafeEqual` LÈVE sur deux tampons de longueurs différentes.
     * Sans le contrôle de longueur qui le précède, un aléa trop court ne
     * rendrait pas « faux » : il ferait tomber le serveur local.
     */
    for (const recu of ["", "a", "a".repeat(44), "a".repeat(200)]) {
      expect(() => nonceValide(attente, recu, T)).not.toThrow();
      expect(nonceValide(attente, recu, T)).toBe(false);
    }
  });

  it("refuse ce qui n'est pas une chaîne", () => {
    for (const recu of [null, undefined, 42, {}, ["a".repeat(43)]]) {
      expect(nonceValide(attente, recu, T)).toBe(false);
    }
  });
});
