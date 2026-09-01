import { detectRole } from "./riot-role";

/**
 * Le rôle décide du barème, donc de la dette.
 *
 * Un support compté comme jungler paie ses morts trois points au lieu de deux
 * et deux dixièmes, et ses assists lui rapportent un au lieu d'un et six
 * dixièmes. C'est la même famille que « le rôle deviné était une constante » :
 * une erreur de rôle ne se voit nulle part et se paie en pompes.
 *
 * Ce module n'avait aucun test. Il en a maintenant, y compris sur le repli —
 * qui n'est pas un détail (voir le dernier bloc).
 */
describe("le rôle lu chez Riot", () => {
  it("traduit les cinq positions", () => {
    const cas: [string, string][] = [
      ["TOP", "Top"], ["JUNGLE", "Jungle"], ["MIDDLE", "Mid"],
      ["BOTTOM", "ADC"], ["UTILITY", "Support"],
    ];
    for (const [riot, chez_nous] of cas) {
      expect(detectRole({ queueId: 420 }, { teamPosition: riot })).toBe(chez_nous);
    }
  });

  it("préfère teamPosition à individualPosition", () => {
    // Riot rend les deux, et elles divergent sur les parties où quelqu'un a
    // changé de voie. `teamPosition` est celle que Riot dit fiable.
    expect(detectRole({ queueId: 420 },
      { teamPosition: "UTILITY", individualPosition: "TOP" })).toBe("Support");
  });

  it("retombe sur individualPosition quand teamPosition manque", () => {
    expect(detectRole({ queueId: 420 }, { individualPosition: "JUNGLE" })).toBe("Jungle");
    // Une chaîne vide n'est pas une position : c'est ce que Riot met quand il
    // ne sait pas, et `||` doit alors passer à la suivante.
    expect(detectRole({ queueId: 420 },
      { teamPosition: "", individualPosition: "TOP" })).toBe("Top");
  });

  describe("les modes qui n'ont pas de voie", () => {
    it("reconnaît l'ARAM par ses trois signes", () => {
      for (const info of [{ gameMode: "ARAM" }, { mapId: 12 }, { queueId: 450 }]) {
        expect(detectRole(info, { teamPosition: "MIDDLE" })).toBe("ARAM");
      }
    });

    it("reconnaît l'Arena, files 3x6 comprise", () => {
      for (const info of [{ gameMode: "CHERRY" }, { queueId: 1700 }, { queueId: 1750 }]) {
        expect(detectRole(info, { teamPosition: "TOP" })).toBe("Arena");
      }
    });

    it("fait passer le mode avant la position", () => {
      // Une partie d'ARAM porte quand même une position : la lire donnerait un
      // rôle de Faille sur une carte qui n'en a pas.
      expect(detectRole({ queueId: 450 }, { teamPosition: "UTILITY" })).toBe("ARAM");
    });
  });

  /**
   * Le repli, et pourquoi il est écrit ici plutôt que corrigé.
   *
   * Une position inconnue devient « Mid ». C'est un choix par défaut, pas une
   * lecture — et il a exactement le défaut déjà corrigé du côté de la
   * détection locale, où « sans rôle connu » retombait sur « Jungle ».
   *
   * La différence tient au coût de l'alternative : refuser ferait perdre une
   * partie entière importée de Riot pour un détail de pondération, alors que
   * du côté de la détection locale ce qu'on refusait était une ISSUE inventée,
   * qui crée une dette qu'on ne doit pas. Les deux ne se valent pas.
   *
   * Le comportement est donc figé par un test plutôt que changé : c'est un
   * arbitrage produit, il figure dans les questions.
   */
  it("retombe sur Mid quand la position est inconnue, et c'est un choix", () => {
    expect(detectRole({ queueId: 420 }, {})).toBe("Mid");
    expect(detectRole({ queueId: 420 }, { teamPosition: "INVENTED" })).toBe("Mid");
  });

  it("ne tombe pas sur une réponse vide", () => {
    expect(detectRole({}, {})).toBe("Mid");
  });
});
