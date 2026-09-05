import fs from "fs";
import path from "path";
import { JEUX } from "@/lib/jeux";

/**
 * Le nombre de jeux ne s'écrit pas à la main.
 *
 * Il était écrit ONZE fois — deux dictionnaires, six langues — et il disait
 * quinze depuis qu'Overwatch avait porté le catalogue à seize. Deux jours
 * pendant lesquels la première phrase de la page d'accueil et le premier
 * écran d'un compte neuf annonçaient un jeu de moins que le produit.
 *
 * C'est le défaut que ce journal trouve le plus souvent : un nombre écrit une
 * fois au-dessus de quelque chose qui bouge. La page de téléchargement
 * l'avait évité deux jours plus tôt en ne portant AUCUN nombre — et les onze
 * autres endroits gardaient le leur.
 *
 * Le nombre part donc du CATALOGUE, en chiffres. Le prix est que le français
 * écrit « 16 jeux » au lieu de « Seize jeux », qui se lit mieux ; le
 * raisonnement est celui déjà tenu pour la longueur du code d'invitation, et
 * il penche ici dans l'autre sens, parce que le changement n'est pas une
 * hypothèse — il a déjà eu lieu deux fois.
 */

const DICOS = path.join(__dirname, "lib", "i18n", "dictionaries");

/**
 * Ce qui compte comme « un nombre de jeux du CATALOGUE écrit à la main ».
 *
 * Le premier jet cherchait « un nombre suivi du mot jeu », et il a rendu
 * quatre faux positifs : « Last 20 games from your Riot account » et
 * « 105 games, 55% win rate » comptent des PARTIES, pas des entrées de
 * catalogue. Un garde qui crie sur ce qui va bien finit par ne plus se lire.
 *
 * Trois formes seulement sont fautives, et le tri s'éprouve sur des cas
 * fabriqués parce que le dépôt sain n'en contient aucune :
 *
 * - un numéral EN TOUTES LETTRES suivi du mot jeu : personne n'écrit
 *   « cent-cinq parties » pour un compte de parties ;
 * - des chiffres suivis d'un mot qui ne désigne QUE une entrée de catalogue
 *   (« タイトル », « 款游戏 ») ;
 * - des chiffres suivis du mot jeu, sur une ligne qui parle de catalogue.
 */
const LETTRES = [
  "[Qq]uinze", "[Ss]eize", "[Dd]ix-sept",
  "[Ff]ifteen", "[Ss]ixteen", "[Ss]eventeen",
  "[Qq]uince", "[Dd]ieciséis", "[Dd]iecisiete",
  "[Ff]ünfzehn", "[Ss]echzehn", "[Ss]iebzehn",
  "十[五六七]",
].join("|");
const MOTS_JEU = ["jeux", "games", "juegos", "Spiele", "ゲーム", "游戏"].join("|");
/** Ces deux-là ne désignent jamais une partie jouée. */
const MOTS_CATALOGUE_SEUL = ["タイトル", "款游戏"].join("|");
const MOT_CATALOGUE = /catalogue|catalog|catálogo|Katalog|目录|カタログ/;

export function ecritALaMain(ligne: string): boolean {
  const nu = sansInterpolations(ligne);
  if (new RegExp("(?:" + LETTRES + ")\\s*(?:" + MOTS_JEU + "|" + MOTS_CATALOGUE_SEUL + ")").test(nu)) return true;
  if (new RegExp("\\d+\\s*(?:" + MOTS_CATALOGUE_SEUL + ")").test(nu)) return true;
  if (new RegExp("\\d+\\s*(?:" + MOTS_JEU + ")").test(nu) && MOT_CATALOGUE.test(nu)) return true;
  return false;
}

function fichiers(): string[] {
  return fs.readdirSync(DICOS).filter((f) => f.endsWith(".ts") && !f.includes(".test."));
}

/**
 * Le texte des LITTÉRAUX seulement.
 *
 * Un gabarit qui interpole `${n}` est légitime — c'est exactement la forme
 * qu'on veut — et son texte contient malgré tout « ${n} jeux ». On écarte
 * donc ce qui est interpolé avant de chercher.
 */
export function sansInterpolations(texte: string): string {
  return texte.replace(/\$\{[^}]*\}/g, " ");
}

describe("le nombre de jeux vient du catalogue", () => {
  const lus = fichiers().map((f) => [f, fs.readFileSync(path.join(DICOS, f), "utf8")] as const);

  it("le recensement lit les dictionnaires, et il y en a", () => {
    // Sans ce témoin, un dossier renommé rendrait le contrôle vert en
    // n'ouvrant aucun fichier.
    expect(lus.length).toBeGreaterThanOrEqual(20);
  });

  it("aucun dictionnaire n'écrit un nombre de jeux à la main", () => {
    const fautifs: string[] = [];
    for (const [f, texte] of lus) {
      for (const ligne of texte.split("\n")) {
        if (ecritALaMain(ligne)) fautifs.push(f + " : " + ligne.trim().slice(0, 90));
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("les deux écrans qui l'annoncent le prennent du catalogue", () => {
    // Le gabarit juste ne sert à rien si personne ne lui passe le vrai
    // nombre : c'est le BRANCHEMENT qu'on éprouve, pas l'intention.
    const ecrans = [
      path.join(__dirname, "app", "[locale]", "LandingClient.tsx"),
      path.join(__dirname, "components", "OnboardingModal.tsx"),
    ];
    const fautifs = ecrans.filter((e) => !/JEUX\.length/.test(fs.readFileSync(e, "utf8")));
    expect(fautifs).toEqual([]);
  });

  it("le catalogue en compte plus d'un", () => {
    // Un catalogue vide rendrait « 0 jeux » sur la page d'accueil sans qu'un
    // seul test ne tombe.
    expect(JEUX.length).toBeGreaterThan(1);
  });
});

describe("le tri, sur des cas fabriqués", () => {
  // L'état sain du dépôt est zéro trouvaille : les fichiers réels ne peuvent
  // pas distinguer un tri juste d'un tri aveugle.
  const cas: [string, boolean][] = [
    ["Last 20 games from your Riot account", false],
    ["The dashboard: 105 games, 55% win rate", false],
    ["`${n} jeux, dont League of Legends`", false],
    ["Quinze jeux au catalogue", true],
    ["Fifteen games in the catalogue", true],
    ["Fünfzehn Spiele im Katalog", true],
    ["目录里有十五款游戏", true],
    ["カタログには 15 タイトル", true],
    ["16 games in the catalogue", true],
  ];
  for (const [ligne, attendu] of cas) {
    it((attendu ? "refuse" : "accepte") + " " + JSON.stringify(ligne.slice(0, 40)), () => {
      expect(ecritALaMain(ligne)).toBe(attendu);
    });
  }
});

describe("le retrait des interpolations", () => {
  const cas = [
    { src: "`${n} jeux`", attendu: "`  jeux`" },
    { src: '"Quinze jeux"', attendu: '"Quinze jeux"' },
    { src: "`a ${x} b ${y} c`", attendu: "`a   b   c`" },
  ];
  for (const c of cas) {
    it("rend " + JSON.stringify(c.attendu), () => {
      expect(sansInterpolations(c.src)).toBe(c.attendu);
    });
  }
});
