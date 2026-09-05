import fs from "fs";
import path from "path";

/**
 * Le français n'accorde pas un participe sur son lecteur.
 *
 * « si tu es arrivé ici autrement », « Vous êtes connecté dans
 * l'application » : le participe s'accorde au masculin, donc le produit donne
 * un genre à quelqu'un dont il ne sait rien. C'est la même décision que celle
 * déjà écrite pour « 他的昵称 » et « Sein Anzeigename » — sauf qu'ici c'est la
 * langue SOURCE, celle qu'on relit.
 *
 * **Et la règle a une limite qui se dit.** Le journal porte, deux entrées plus
 * haut, que reformuler le français source est « un choix de voix, pas une
 * correction de traduction ». C'est vrai quand le neutre coûte quelque chose ;
 * ça ne l'est pas quand il ne coûte rien. « si tu arrives ici autrement » dit
 * exactement la même chose que « si tu es arrivé ici autrement », et
 * « La connexion est faite » remplace « Vous êtes connecté » sans changer de
 * registre. Ce garde ne tient donc QUE la forme mécanique — un participe
 * accordé derrière « tu es » ou « vous êtes » — et laisse hors de son champ
 * tout ce qui demanderait de réécrire une phrase.
 */

const DICOS = path.join(__dirname, "lib", "i18n", "dictionaries");

/**
 * Ce qui est toléré, avec sa raison.
 *
 * « Rester connecté » est l'idiome français de cette case sur tous les sites ;
 * le neutre y coûterait la reconnaissance immédiate du libellé, et c'est
 * précisément le genre d'arbitrage qui appartient au propriétaire.
 */
const TOLERE: Record<string, string> = {
  resterConnecte: "idiome universel de la case « rester connecté » ; le neutre coûterait la reconnaissance du libellé",
};

/**
 * Un participe accordé juste derrière l'auxiliaire, sur la personne.
 *
 * Deux détails que le premier jet a ratés, et qui rendaient le motif AVEUGLE
 * à tous ses cas : la classe de lettres ne doit pas contenir « é », sinon
 * elle avale la terminaison et le motif ne trouve plus rien ; et
 * l'alternance doit être insensible à la casse, « Vous êtes » commençant une
 * phrase.
 *
 * Et la borne de fin ne peut PAS être un `\b` : le `\b` de JavaScript repose
 * sur `[A-Za-z0-9_]`, donc « é » y est un caractère NON-mot et « connecté »
 * en fin de chaîne n'a aucune frontière après lui. Le motif trouvait
 * « invitée » — qui finit par une lettre latine — et ratait « connecté ».
 * C'est la troisième fois cette nuit que cette borne coûte quelque chose ;
 * elle s'écrit à la main, sur une classe qui contient les accents.
 *
 * Sa LIMITE est qu'il ne connaît que les participes en « é » — « inscrit »,
 * « prêt », « sûr » lui échappent. Elle est écrite plutôt que laissée à
 * découvrir : le dépôt n'en contient aucun sur son lecteur, et un motif qui
 * les couvrirait demanderait une liste de mots, donc vieillirait.
 */
const ACCORDE_SUR_LE_LECTEUR =
  /(?:tu (?:es|étais|seras)|vous (?:êtes|étiez|serez))\s+[a-zàâçèêëîïôûùüÿñ]+é(?:e|s|es)?(?![a-zàâçéèêëîïôûùüÿñ])/i;

function blocFrancais(source: string): string {
  const fin = source.indexOf("\n  en: {");
  return fin > 0 ? source.slice(0, fin) : source;
}

describe("le français ne donne pas de genre à son lecteur", () => {
  const dicos = fs.readdirSync(DICOS).filter((f) => f.endsWith(".ts") && !f.includes(".test."));

  it("le recensement lit les dictionnaires, et il y en a", () => {
    // Sans ce témoin, un dossier renommé rendrait le contrôle vert en
    // n'ouvrant aucun fichier.
    expect(dicos.length).toBeGreaterThanOrEqual(20);
  });

  it("le découpage trouve un bloc français plus court que le fichier", () => {
    // Si `blocFrancais` cessait de trouver sa borne, il rendrait le fichier
    // ENTIER — donc le contrôle chercherait aussi dans l'anglais, où il ne
    // trouverait rien de son motif, et passerait au vert pour la mauvaise
    // raison. On vérifie qu'il coupe vraiment.
    const coupes = dicos
      .map((f) => fs.readFileSync(path.join(DICOS, f), "utf8"))
      .filter((s) => blocFrancais(s).length < s.length);
    expect(coupes.length).toBeGreaterThanOrEqual(20);
  });

  it("aucun participe ne s'accorde derrière « tu es » ou « vous êtes »", () => {
    const fautifs: string[] = [];
    for (const f of dicos) {
      for (const ligne of blocFrancais(fs.readFileSync(path.join(DICOS, f), "utf8")).split("\n")) {
        if (!ACCORDE_SUR_LE_LECTEUR.test(ligne)) continue;
        const cle = ligne.trim().match(/^([A-Za-z0-9_]+)\s*:/)?.[1];
        if (cle && TOLERE[cle]) continue;
        fautifs.push(f + " : " + ligne.trim().slice(0, 110));
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("le motif reconnaît la forme, et laisse le reste", () => {
    // L'état sain du dépôt est zéro trouvaille : les fichiers réels ne
    // distinguent pas un motif juste d'un motif aveugle.
    for (const c of ["si tu es arrivé ici", "Vous êtes connecté", "vous êtes invitée"]) {
      expect(ACCORDE_SUR_LE_LECTEUR.test(c)).toBe(true);
    }
    for (const c of [
      "Tu as refusé les notifications",   // avec « avoir », sans objet devant : invariable
      "Le serveur a refusé",              // porte sur le serveur
      "Accès refusé",                     // porte sur l'accès
      "si tu arrives ici autrement",      // la forme corrigée
    ]) {
      expect(ACCORDE_SUR_LE_LECTEUR.test(c)).toBe(false);
    }
  });

  it("la tolérance désigne encore une clé vivante", () => {
    const tout = dicos.map((f) => fs.readFileSync(path.join(DICOS, f), "utf8")).join("\n");
    const mortes = Object.keys(TOLERE).filter((c) => !new RegExp("\\b" + c + "\\s*:").test(tout));
    expect(mortes).toEqual([]);
  });
});
