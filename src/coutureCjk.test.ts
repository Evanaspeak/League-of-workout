import fs from "fs";
import path from "path";
import { colleCjk } from "@/lib/i18n/cjk";
import { exercices } from "@/lib/i18n/dictionaries/exercices";
import { enJeu } from "@/lib/i18n/dictionaries/enJeu";
import { dashboard } from "@/lib/i18n/dictionaries/dashboard";
import { textesNotification } from "@/lib/i18n/notifications";
import { amis } from "@/lib/i18n/dictionaries/amis";
import { textesBilan } from "@/lib/i18n/courriels";
import { dureeLocalisee } from "@/lib/i18n/duree";
import { etiquetteLocale } from "@/lib/i18n/langues";
import { sansCommentaires } from "./test/sansCommentaires";

/**
 * Une espace latine plantée entre deux idéogrammes.
 *
 * Le japonais et le chinois séparent un morceau LATIN de ce qui l'entoure, et
 * ce projet suit la convention partout : « 60 試合 », « 12 局 ». Elle cesse de
 * valoir quand la valeur interpolée est elle-même en idéogrammes — ce qui est
 * arrivé à l'instant où les durées sont passées par `Intl` : la pastille rendait
 * « 5分 から効きます » et « 5分钟 起生效 ».
 *
 * Et ça ne se décide pas à l'écriture : la même clé reçoit « 5分20秒 » pour la
 * boxe et « 38 » pour les pompes. Les deux sens sont donc éprouvés ici — sans le
 * second, retirer l'espace en dur passerait pour une correction.
 */

/** Les clés qui reçoivent une quantité DÉJÀ mise en forme par nos formateurs. */
const A_COUTURE: { nom: string; rendre: (l: "zh" | "ja", v: string) => string }[] = [
  { nom: "exercices.detteSeuil", rendre: (l, v) => (exercices as never as Record<string, { detteSeuil(v: string): string }>)[l].detteSeuil(v) },
  { nom: "exercices.detteRappelCorps", rendre: (l, v) => (exercices as never as Record<string, { detteRappelCorps(v: string): string }>)[l].detteRappelCorps(v) },
  { nom: "exercices.detteConvertiObjectif", rendre: (l, v) => (exercices as never as Record<string, { detteConvertiObjectif(q: string, n: string): string; boxeNom: string }>)[l].detteConvertiObjectif(v, (exercices as never as Record<string, { boxeNom: string }>)[l].boxeNom) },
  { nom: "enJeu.aFaire", rendre: (l, v) => (enJeu as never as Record<string, { aFaire(v: string): string }>)[l].aFaire(v) },
  { nom: "enJeu.rappelMaintenant", rendre: (l, v) => (enJeu as never as Record<string, { rappelMaintenant(v: string): string }>)[l].rappelMaintenant(v) },
  { nom: "dashboard.plafondCorps", rendre: (l, v) => (dashboard as never as Record<string, { plafondCorps(a: string, b: string): string }>)[l].plafondCorps(v, v) },
  { nom: "notifications.seuil", rendre: (l, v) => textesNotification(l).seuil(v).corps },
  { nom: "notifications.matin", rendre: (l, v) => textesNotification(l).matin(v).corps },
  /**
   * Et les neuf clés de l'écran des amis.
   *
   * Elles reçoivent un PSEUDO, un NOM DE GROUPE ou une DATE localisée —
   * trois textes dont on ne connaît pas l'écriture en écrivant le gabarit.
   * `recordsLigne` est le cas certain : sa date sort toujours en idéogrammes
   * (« 9月5日 に 300 ポイント »), donc la couture était là pour tout le monde,
   * quel que soit le pseudo. Les huit autres ne cousent que devant un pseudo
   * japonais ou chinois, ce qui est un cas légitime et non une hypothèse.
   */
  ...([
    "envoyeeA", "accepteeAvec", "retirerConfirme", "copierNomme",
    "quitterConfirme", "quitterDernier", "equipeVoirNomme", "equipeRelayerNomme",
  ] as const).map((cle) => ({
    nom: `amis.${cle}`,
    rendre: (l: "zh" | "ja", v: string) =>
      (amis as never as Record<string, Record<string, (p: string) => string>>)[l][cle](v),
  })),
  /**
   * Le sujet du bilan hebdomadaire, qui part par COURRIEL.
   *
   * C'est le seul message que le produit envoie de lui-même, donc le seul
   * endroit où personne ne peut aller vérifier ailleurs ce qu'il lit. Le
   * chinois écrit déjà « ${p}，这是你的一周 » sans espace ; le japonais posait
   * la sienne.
   */
  {
    nom: "courriels.titre",
    rendre: (l, v) => textesBilan(l).titre(v),
  },
  {
    nom: "amis.recordsLigne",
    rendre: (l: "zh" | "ja", v: string) =>
      (amis as never as Record<string, { recordsLigne(a: string, b: string, c: string): string }>)[l]
        .recordsLigne("太郎", "300", v),
  },
];

const CJK = "\\u3000-\\u303F\\u3040-\\u309F\\u30A0-\\u30FF\\u4E00-\\u9FFF\\uFF00-\\uFFEF";
const COUTURE = new RegExp(`[${CJK}] +[${CJK}]`);

describe("aucune espace latine entre deux idéogrammes", () => {
  it("le collage ferme la couture, et LAISSE l'espace du latin", () => {
    // L'état sain du dépôt est zéro trouvaille : les valeurs réelles ne
    // distinguent pas un collage juste d'un collage aveugle.
    expect(colleCjk("5分20秒 から効きます")).toBe("5分20秒から効きます");
    expect(colleCjk("5分钟 起生效")).toBe("5分钟起生效");
    // Les deux coutures de la même phrase se traitent différemment, et c'est
    // tout le sujet : « は 5 » sépare un idéogramme d'un CHIFFRE, donc elle
    // reste ; « 分 溜 » sépare deux idéogrammes, donc elle tombe. Ma première
    // version attendait la disparition des deux, et le test l'a démentie.
    expect(colleCjk("今日は 5分 溜まりました")).toBe("今日は 5分溜まりました");
    // Un nombre latin garde la sienne : c'est la convention du projet, et la
    // retirer serait le défaut inverse.
    expect(colleCjk("38 が残っています。")).toBe("38 が残っています。");
    expect(colleCjk("60 試合")).toBe("60 試合");
    expect(colleCjk("Kayn さん")).toBe("Kayn さん");
    // Trois idéogrammes séparés par deux espaces : une passe unique n'en
    // retirerait qu'une, la seconde étant consommée par la première.
    expect(colleCjk("分 秒 時")).toBe("分秒時");
  });

  it("les gabarits ne cousent rien quand la valeur est en idéogrammes", () => {
    for (const l of ["zh", "ja"] as const) {
      const duree = dureeLocalisee(320, etiquetteLocale(l));
      // Le témoin de la valeur elle-même : si la durée cessait de sortir en
      // idéogrammes, aucun de ces contrôles ne prouverait plus rien.
      expect({ l, ideogrammes: new RegExp(`[${CJK}]$`).test(duree) }).toEqual({ l, ideogrammes: true });
      for (const { nom, rendre } of A_COUTURE) {
        expect({ nom, l, rendu: COUTURE.test(rendre(l, duree)) }).toEqual({ nom, l, rendu: false });
      }
    }
  });

  it("et ils gardent l'espace quand la valeur est un nombre latin", () => {
    // Sans ce contrôle, retirer l'espace en dur des gabarits passerait pour une
    // correction — alors que ça casserait le cas des pompes, qui est le défaut.
    for (const l of ["zh", "ja"] as const) {
      /**
       * Tous n'ont pas d'espace à garder : le chinois du bilan hebdomadaire
       * écrit « ${p}，这是你的一周 », sans aucune. Ce qu'on éprouve est donc
       * que ceux qui EN ONT une la gardent — et le témoin exige qu'ils soient
       * la grande majorité, sans quoi ce contrôle ne dirait plus rien.
       */
      const avecEspace = A_COUTURE.filter(({ rendre }) => / /.test(rendre(l, "5分")) || / /.test(rendre(l, "38")));
      // Le japonais en a dix-huit sur dix-huit, le chinois dix-sept : seul son
      // sujet de courriel n'a jamais porté d'espace. Le témoin refuse que ce
      // sous-ensemble se vide, ce qui rendrait le contrôle muet.
      expect(avecEspace.length).toBeGreaterThanOrEqual(A_COUTURE.length - 1);
      for (const { nom, rendre } of avecEspace) {
        expect({ nom, l, garde: / /.test(rendre(l, "38")) }).toEqual({ nom, l, garde: true });
      }
    }
  });

  it("chaque clé déclarée passe réellement par le collage", () => {
    // Le rendu peut être juste par accident — un gabarit sans idéogramme
    // adjacent ne cousrait rien de toute façon. On exige donc l'APPEL.
    const fichiers = [
      "src/lib/i18n/dictionaries/exercices.ts",
      "src/lib/i18n/dictionaries/enJeu.ts",
      "src/lib/i18n/dictionaries/dashboard.ts",
      "src/lib/i18n/notifications.ts",
      "src/lib/i18n/dictionaries/amis.ts",
      "src/lib/i18n/courriels.ts",
    ];
    const sources = fichiers.map((f) => sansCommentaires(fs.readFileSync(path.join(process.cwd(), f), "utf8")));
    const total = sources.reduce((n, s) => n + (s.match(/colleCjk\(/g) ?? []).length, 0);
    // Huit clés, deux langues chacune, plus les imports.
    expect(total).toBeGreaterThanOrEqual(34);
    for (const s of sources) expect(s).toMatch(/colleCjk\(/);
  });
});
