import { estSansEnjeu, marquerSansEnjeu, oublierSansEnjeu, PEREMPTION_MS } from "@/lib/sansEnjeu";

const CLE = "low_partie_sans_enjeu";
const T0 = 1_800_000_000_000;

/**
 * Le stockage se pose sur `window`, pas sur `globalThis`.
 *
 * Le module passe par `src/lib/stockage.ts`, qui lit `window.localStorage` :
 * c'est l'accesseur qui lève quand le navigateur bloque les données de site.
 * Une doublure posée à côté ne serait jamais lue, et la suite éprouverait un
 * stockage vide en croyant éprouver le sien — la leçon est déjà écrite dans
 * `fileHorsLigne.test.ts`, où onze tests étaient tombés d'un coup.
 */
function stockageFactice() {
  let donnees: Record<string, string> = {};
  return {
    getItem: (k: string) => donnees[k] ?? null,
    setItem: (k: string, v: string) => { donnees[k] = v; },
    removeItem: (k: string) => { delete donnees[k]; },
  };
}

beforeEach(() => {
  globalThis.window = {
    localStorage: stockageFactice(),
  } as unknown as Window & typeof globalThis;
});

describe("le souvenir d'un refus", () => {
  it("n'existe pas tant qu'on n'a rien refusé", () => {
    expect(estSansEnjeu(T0)).toBe(false);
  });

  it("survit entre le refus et la fin de la partie", () => {
    marquerSansEnjeu(T0);
    expect(estSansEnjeu(T0 + 40 * 60 * 1000)).toBe(true);
  });

  /** Une partie qui commence efface ce qui a été refusé avant elle. */
  it("s'efface au démarrage de la partie suivante", () => {
    marquerSansEnjeu(T0);
    oublierSansEnjeu();
    expect(estSansEnjeu(T0 + 1000)).toBe(false);
  });

  /**
   * Le filet du démarrage manqué : application relancée en cours de partie,
   * événement perdu. Sans péremption, une marque de la veille ferait passer
   * pour refusée une partie que personne n'a refusée.
   */
  it("se périme au bout de six heures", () => {
    marquerSansEnjeu(T0);
    expect(estSansEnjeu(T0 + PEREMPTION_MS)).toBe(true);
    expect(estSansEnjeu(T0 + PEREMPTION_MS + 1)).toBe(false);
  });

  it("une marque datée du futur ne vaut rien : c'est une horloge changée", () => {
    marquerSansEnjeu(T0 + 60_000);
    expect(estSansEnjeu(T0)).toBe(false);
  });

  /**
   * Le stockage n'est pas un format : n'importe qui peut y écrire. Dans le
   * doute on enregistre NORMALEMENT — perdre le coût d'une partie qu'on
   * voulait compter se corrige à la main ; l'inverse est une dette qu'on n'a
   * pas méritée.
   */
  it.each([
    ["une chaîne", '"oui"'],
    ["un nombre", "42"],
    ["un objet sans date", "{}"],
    ["une date qui n'en est pas une", '{"le":"hier"}'],
    /**
     * Le cas qui distingue vraiment le contrôle de type.
     *
     * Une date écrite EN CHAÎNE mais numériquement valable passait tous les
     * autres contrôles : la comparaison avec le présent coerce, la
     * soustraction aussi. Trouvé en sabotant — retirer le contrôle de type ne
     * faisait tomber aucun test, parce qu'aucun cas ne le distinguait des
     * lignes voisines.
     */
    ["une date en chaîne", '{"le":"1800000000000"}'],
    ["une date infinie", '{"le":1e999}'],
    ["du JSON cassé", "{le:"],
  ])("%s ne marque rien", (_, brut) => {
    window.localStorage.setItem(CLE, brut);
    expect(estSansEnjeu(T0)).toBe(false);
  });
});
