import { rappelerPesee, JOURS_ENTRE_PESEES, type EtatRappelPesee } from "@/lib/rappelPesee";

const LE_10 = new Date("2026-09-10T09:00:00Z");
const base: EtatRappelPesee = {
  actif: true,
  dernierePesee: "2026-09-01",
  dernierRappel: null,
  creeLe: new Date("2026-01-01T00:00:00Z"),
};

describe("le rappel de pesée", () => {
  it("ne part jamais quand le réglage est éteint", () => {
    // Réponse 022 : le rappel est OPTIONNEL, et il est éteint par défaut. Ce
    // n'est pas un détail de confort — c'est un message sur le poids de
    // quelqu'un, envoyé à quelqu'un qui ne l'a pas demandé.
    expect(rappelerPesee({ ...base, actif: false }, LE_10)).toBe(false);
  });

  it("ne rappelle pas à qui s'est pesé cette semaine", () => {
    expect(rappelerPesee({ ...base, dernierePesee: "2026-09-08" }, LE_10)).toBe(false);
  });

  it("rappelle au bout de sept jours sans pesée", () => {
    expect(rappelerPesee(base, LE_10)).toBe(true);
  });

  it("ne se répète pas tous les matins de la semaine suivante", () => {
    /**
     * Le défaut déjà écrit au journal pour la relance des absents : « une
     * application qui redit tous les jours "tu nous manques" se fait couper ».
     * Sans cette condition, le rappel repartirait chaque matin dès le huitième
     * jour.
     */
    const hier = new Date(LE_10.getTime() - 24 * 60 * 60 * 1000);
    expect(rappelerPesee({ ...base, dernierRappel: hier }, LE_10)).toBe(false);
  });

  it("repart une semaine après le dernier rappel", () => {
    const ilYA8Jours = new Date(LE_10.getTime() - 8 * 24 * 60 * 60 * 1000);
    expect(rappelerPesee({ ...base, dernierRappel: ilYA8Jours }, LE_10)).toBe(true);
  });

  it("compte depuis l'ouverture du compte quand on ne s'est jamais pesé", () => {
    /**
     * Les deux fautes possibles, et elles sont symétriques. Rendre `true`
     * d'emblée enverrait un rappel le matin même où l'on allume le réglage ;
     * rendre `false` pour toujours rendrait le réglage inopérant pour celui
     * qui en a le plus besoin.
     */
    const hier = new Date(LE_10.getTime() - 24 * 60 * 60 * 1000);
    expect(rappelerPesee({ ...base, dernierePesee: null, creeLe: hier }, LE_10)).toBe(false);
    const ilYA9Jours = new Date(LE_10.getTime() - 9 * 24 * 60 * 60 * 1000);
    expect(rappelerPesee({ ...base, dernierePesee: null, creeLe: ilYA9Jours }, LE_10)).toBe(true);
  });

  it("ne part pas sur un jour illisible plutôt que de partir quand même", () => {
    // Dans le doute on se TAIT : un rappel de trop se paie en désabonnement,
    // un rappel manqué se rattrape la semaine suivante.
    expect(rappelerPesee({ ...base, dernierePesee: "pas-une-date" }, LE_10)).toBe(false);
  });

  it("garde la maille de sept jours", () => {
    // Un pin : changer la cadence d'un rappel en silence change ce que le
    // produit promet dans les réglages.
    expect(JOURS_ENTRE_PESEES).toBe(7);
  });
});
