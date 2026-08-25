import { retirerDeLaDette } from "./dette";

/**
 * Le retrait de dette est écrit pour ne rien perdre de ce qui arrive en même
 * temps : c'est la raison d'être du module, et elle ne se voit pas à la
 * lecture — `decrement` et une soustraction rendent le même chiffre quand
 * personne d'autre n'écrit. Ce qui les sépare, c'est la forme de la requête
 * envoyée à la base, donc c'est elle qu'on regarde.
 */

type Ecriture = { data: Record<string, unknown> };

function baseFausse(depart: number) {
  let valeur = depart;
  const ecritures: Ecriture[] = [];
  return {
    ecritures,
    valeurActuelle: () => valeur,
    user: {
      findUnique: async () => ({ dettePointsDus: valeur }),
      update: async ({ data }: { data: Record<string, unknown> }) => {
        ecritures.push({ data });
        const dec = (data.dettePointsDus as { decrement?: number } | number | undefined);
        if (typeof dec === "object" && dec && typeof dec.decrement === "number") {
          valeur -= dec.decrement;
        } else if (typeof dec === "number") {
          valeur = dec;
        }
        return { dettePointsDus: valeur };
      },
    },
  };
}

// Le double ne connaît que `user`, comme le module lui-même.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = (b: ReturnType<typeof baseFausse>) => b as any;

describe("retirerDeLaDette", () => {
  it("retire par décrément atomique, jamais par réécriture de la valeur", async () => {
    const b = baseFausse(50);
    const reste = await retirerDeLaDette(client(b), "u1", 20);

    expect(reste).toBe(30);
    // C'est le point du module : une valeur absolue écraserait le paiement
    // d'à côté, un décrément s'y ajoute.
    expect(b.ecritures[0].data.dettePointsDus).toEqual({ decrement: 20 });
  });

  it("éteint la dette et sa date de début quand on descend sous zéro", async () => {
    const b = baseFausse(10);
    const reste = await retirerDeLaDette(client(b), "u1", 25);

    expect(reste).toBe(0);
    // Les deux ensemble : une date de début qui survit à une dette soldée
    // laisse courir un compteur de retard sur rien.
    expect(b.ecritures[1].data).toEqual({ dettePointsDus: 0, detteDepuis: null });
    expect(b.valeurActuelle()).toBe(0);
  });

  it("éteint aussi la date quand on tombe pile sur zéro", async () => {
    const b = baseFausse(30);
    const reste = await retirerDeLaDette(client(b), "u1", 30);

    expect(reste).toBe(0);
    expect(b.ecritures[1].data).toEqual({ dettePointsDus: 0, detteDepuis: null });
  });

  it("ne remet pas la date à zéro tant qu'il reste quelque chose à payer", async () => {
    const b = baseFausse(50);
    await retirerDeLaDette(client(b), "u1", 20);

    expect(b.ecritures).toHaveLength(1);
    expect(b.ecritures.some((e) => "detteDepuis" in e.data)).toBe(false);
  });

  it("n'écrit rien pour un retrait nul ou négatif", async () => {
    const b = baseFausse(40);

    expect(await retirerDeLaDette(client(b), "u1", 0)).toBe(40);
    expect(await retirerDeLaDette(client(b), "u1", -5)).toBe(40);
    expect(b.ecritures).toHaveLength(0);
  });

  it("ne rend jamais une dette négative, même si la base en porte une", async () => {
    // La fenêtre où la valeur passe sous zéro est réelle : elle dure une
    // requête. Ce qui est rendu à l'écran, lui, ne doit jamais l'être.
    const b = baseFausse(-12);

    expect(await retirerDeLaDette(client(b), "u1", 0)).toBe(0);
  });

  it("rend zéro pour un compte introuvable plutôt que de tomber", async () => {
    const b = {
      user: {
        findUnique: async () => null,
        update: async () => ({ dettePointsDus: 0 }),
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await retirerDeLaDette(b as any, "fantome", 0)).toBe(0);
  });
});
