import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RACINE_I18N, fichiersLangue, blocsFrancais, clesFrancaises, francais, cleDeLigne } from "@/test/fichiersLangue";

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

/**
 * La portée est `src/lib/i18n` ENTIER, sous-dossiers compris.
 *
 * Elle était bornée à `dictionaries/` jusqu'au 10 septembre, alors que quinze
 * modules porteurs de texte vivent un dossier au-dessus — et c'est là que
 * deux descriptions Google ont vouvoyé sous des écrans qui tutoient. Le crible
 * manuel des quinze est NÉGATIF pour CETTE règle-ci : aucun n'accorde de
 * participe sur son lecteur aujourd'hui. Ce qu'on ferme est le fichier qu'on
 * ajoutera demain.
 */

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


describe("le français ne donne pas de genre à son lecteur", () => {
  const fichiers = fichiersLangue();
  const sources = fichiers.map((f) => [f, readFileSync(join(RACINE_I18N, f), "utf8")] as const);

  it("le recensement lit les fichiers de langue, et il y en a", () => {
    // Sans ce témoin, un dossier renommé rendrait le contrôle vert en
    // n'ouvrant aucun fichier.
    expect(fichiers.length).toBeGreaterThanOrEqual(20);
  });

  it("les deux formes sont lues, et hors du sous-dossier aussi", () => {
    /**
     * Un témoin PAR FORME, sinon deux aveuglements passent au vert.
     *
     * Le compte de fichiers ne les distingue pas : les cinquante-neuf du
     * sous-dossier suffisent à le satisfaire. Il reste donc vert le jour où le
     * lecteur de blocs cesse de voir les huit blocs à quatre espaces de
     * `metadonnees.ts`, ou la forme sans bloc d'`apiErrors.ts`, où la clé EST
     * le message français.
     */
    expect(sources.filter(([, s]) => blocsFrancais(s).length >= 4).length)
      .toBeGreaterThanOrEqual(1);
    expect(sources.filter(([, s]) => !blocsFrancais(s).length && clesFrancaises(s).length > 20).length)
      .toBeGreaterThanOrEqual(1);
  });

  it("le découpage coupe vraiment, il ne rend pas le fichier entier", () => {
    // Si `blocsFrancais` cessait de trouver ses bornes, il rendrait le fichier
    // ENTIER — donc le contrôle chercherait aussi dans l'anglais, où il ne
    // trouverait rien de son motif, et passerait au vert pour la mauvaise
    // raison.
    const coupes = sources.filter(([, s]) => {
      const b = blocsFrancais(s);
      return b.length > 0 && b.join("").length < s.length;
    });
    expect(coupes.length).toBeGreaterThanOrEqual(20);
  });

  it("aucun participe ne s'accorde derrière « tu es » ou « vous êtes »", () => {
    const fautifs: string[] = [];
    let examinees = 0;
    for (const [f, source] of sources) {
      for (const morceau of francais(source)) {
        for (const ligne of morceau.split("\n")) {
          examinees += 1;
          if (!ACCORDE_SUR_LE_LECTEUR.test(ligne)) continue;
          if (TOLERE[cleDeLigne(ligne)]) continue;
          fautifs.push(f + " : " + ligne.trim().slice(0, 110));
        }
      }
    }
    // Sans ce témoin, un lecteur devenu muet rendrait le contrôle vert en
    // n'ayant lu aucune ligne française.
    expect(examinees).toBeGreaterThan(2000);
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
    const tout = sources.map(([, s]) => s).join("\n");
    const mortes = Object.keys(TOLERE).filter((c) => !new RegExp("\\b" + c + "\\s*:").test(tout));
    expect(mortes).toEqual([]);
  });
});
