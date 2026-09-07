import {
  CLE_VIBRATION, DUREE_VIBRATION_MS, poserVibration, vibrationActive,
  vibrationDisponible, vibrerRepetition,
} from "./vibration";

/**
 * Un `window` fabriqué, comme dans `stockage.test.ts`.
 *
 * La suite tourne en environnement `node` : il n'y a pas de `window`, et
 * `src/lib/stockage.ts` lit `window.localStorage` — pas `globalThis`. Une
 * doublure posée à côté ne serait donc jamais lue, et les tests
 * éprouveraient un stockage vide en croyant éprouver le leur. Le journal
 * porte déjà ce piège, payé par deux suites avant celle-ci.
 */
const global = globalThis as unknown as { window?: Record<string, unknown> };

const memoire = new Map<string, string>();
beforeEach(() => {
  memoire.clear();
  if (!global.window) global.window = {};
  Object.defineProperty(global.window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => memoire.get(k) ?? null,
      setItem: (k: string, v: string) => { memoire.set(k, v); },
      removeItem: (k: string) => { memoire.delete(k); },
    },
  });
});

describe("le réglage de vibration", () => {
  it("est ÉTEINT tant que personne ne l'a allumé", () => {
    // « En option » veut dire qu'on peut l'allumer, pas qu'elle est là.
    expect(vibrationActive()).toBe(false);
  });

  it("se retient et se retire", () => {
    poserVibration(true);
    expect(vibrationActive()).toBe(true);
    expect(memoire.get(CLE_VIBRATION)).toBe("1");
    poserVibration(false);
    expect(vibrationActive()).toBe(false);
  });

  it("ne prend rien d'autre pour un « oui »", () => {
    // Une valeur écrite par une autre version, ou par quelqu'un, ne doit pas
    // allumer une option que personne n'a demandée.
    memoire.set(CLE_VIBRATION, "true");
    expect(vibrationActive()).toBe(false);
  });
});

describe("ce que l'appareil sait faire", () => {
  it("reconnaît un appareil qui vibre, et un qui ne sait pas", () => {
    expect(vibrationDisponible({ vibrate: () => true })).toBe(true);
    // Safari sur iPhone : la moitié des téléphones.
    expect(vibrationDisponible({})).toBe(false);
    expect(vibrationDisponible(undefined)).toBe(false);
  });
});

describe("vibrer à une répétition", () => {
  it("ne vibre pas tant que l'option est éteinte", () => {
    const vibrate = jest.fn(() => true);
    expect(vibrerRepetition({ vibrate })).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it("vibre une impulsion courte quand elle est allumée", () => {
    poserVibration(true);
    const vibrate = jest.fn(() => true);
    expect(vibrerRepetition({ vibrate })).toBe(true);
    // Une impulsion, pas une alerte : elle ne doit pas se confondre avec une
    // notification.
    expect(vibrate).toHaveBeenCalledWith(DUREE_VIBRATION_MS);
    expect(DUREE_VIBRATION_MS).toBeLessThanOrEqual(50);
  });

  it("ne casse rien sur un appareil qui ne sait pas", () => {
    poserVibration(true);
    expect(vibrerRepetition({})).toBe(false);
    expect(vibrerRepetition(undefined)).toBe(false);
  });

  it("ne casse rien quand l'appareil refuse", () => {
    // Certains navigateurs lèvent tant que la page n'a pas été touchée : une
    // vibration perdue ne doit pas interrompre le comptage.
    poserVibration(true);
    expect(vibrerRepetition({ vibrate: () => { throw new Error("refus"); } })).toBe(false);
    expect(vibrerRepetition({ vibrate: () => false })).toBe(false);
  });
});
