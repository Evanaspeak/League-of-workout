import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Le produit TUTOIE, sauf là où il a de bonnes raisons de vouvoyer.
 *
 * La règle existait dans les faits et nulle part ailleurs, donc elle a dérivé :
 * l'écran des réglages disait « Toutes VOS données » sous un titre « TES
 * DONNÉES », le panneau des paliers « Ce que VOUS avez déjà fait » au milieu
 * d'un tableau de bord qui tutoie partout, et les sept étapes des premiers pas
 * vouvoyaient de bout en bout.
 *
 * Ce n'est pas une préférence de style : c'est la voix du produit, et le seul
 * retour d'acquisition qu'on ait jamais eu portait dessus — « ça fait trop
 * IA ». Un texte qui change de registre d'un panneau à l'autre est exactement
 * ce qui donne cette impression.
 *
 * **Trois familles vouvoient, chacune pour sa raison :**
 *
 * - le JURIDIQUE (CGU, politique de confidentialité) : ces textes engagent
 *   l'éditeur, et le vouvoiement y est la convention ;
 * - la SANTÉ (consentement, mises en garde de volume) : on y met de la
 *   distance exprès, c'est un avertissement, pas une conversation ;
 * - les pages PUBLIQUES d'acquisition (calculateur, téléchargement,
 *   simulateur, connexion, source OBS, signalement) : elles s'adressent à
 *   quelqu'un qui n'a pas de compte, et ce choix-là appartient à la marque.
 *
 * Tout le reste — c'est-à-dire l'application une fois la porte passée —
 * tutoie.
 */

const RACINE = join(process.cwd(), "src/lib/i18n/dictionaries");

/** Ce qui vouvoie, et pourquoi. Une exemption sans raison n'en est pas une. */
const VOUVOIENT: Record<string, string> = {
  "cgu.ts": "document juridique",
  "confidentialite.ts": "document juridique",
  "consentementSante.ts": "consentement santé : la distance est voulue",
  "calculateur.ts": "page publique d'acquisition",
  "telechargement.ts": "page publique d'acquisition",
  "simulateur.ts": "page publique d'acquisition",
  "login.ts": "porte d'entrée, avant tout compte",
  "loginButtons.ts": "porte d'entrée, avant tout compte",
  "sourceObs.ts": "lue par le public d'un stream, pas par le compte",
  "signalement.ts": "formulaire ouvert, y compris sans session",
  "layout.ts": "pied de page et mentions, communs aux pages publiques",
};

/**
 * Des clés tolérées une par une, dans des fichiers qui tutoient par ailleurs.
 *
 * L'exemption porte sur la CLÉ et non sur le fichier : posée sur le fichier,
 * elle couvrirait tout le tableau de bord, ce qui est exactement la façon dont
 * une règle se vide de son contenu.
 *
 * Deux raisons distinctes, et elles ne se confondent pas :
 *  - la santé, où la distance est voulue ;
 *  - le « vous » PLURIEL, qui n'est pas un vouvoiement. Aucun motif ne peut
 *    distinguer « vous êtes amis » de « votre compte » : c'est une question de
 *    sens, elle se tranche à la main, une clé à la fois.
 */
const CLES_TOLEREES: Record<string, string> = {
  veilleJour: "mise en garde de santé : la distance est voulue",
  veilleSemaine: "mise en garde de santé : la distance est voulue",
  accepteeAvec: "« vous êtes amis » est un pluriel, pas un vouvoiement",
};

const VOUS = /\b(vous|votre|vos)\b/i;

function blocFrancais(source: string): string | null {
  // `[\s\S]` plutôt que le drapeau `s` : la cible de compilation du projet est
  // antérieure à ES2018, et `tsc` refuse le drapeau.
  const m = /\n {2}fr: \{([\s\S]*?)\n {2}[a-z]{2}: \{/.exec(source);
  return m ? m[1] : null;
}

describe("le registre du produit", () => {
  const fichiers = readdirSync(RACINE)
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

  it("lit bien les dictionnaires", () => {
    // Sans ce témoin, un dossier renommé rendrait le contrôle vert en
    // n'examinant aucun fichier — le défaut que ce projet trouve le plus.
    expect(fichiers.length).toBeGreaterThan(20);
    expect(fichiers.filter((f) => blocFrancais(readFileSync(join(RACINE, f), "utf8"))).length)
      .toBeGreaterThan(20);
  });

  it("tutoie partout, sauf là où le vouvoiement porte sa raison", () => {
    const fautifs: string[] = [];
    for (const f of fichiers) {
      if (VOUVOIENT[f]) continue;
      const bloc = blocFrancais(readFileSync(join(RACINE, f), "utf8"));
      if (!bloc) continue;
      for (const ligne of bloc.split("\n")) {
        if (!VOUS.test(ligne)) continue;
        const cle = /^\s*([A-Za-z0-9_]+)\s*:/.exec(ligne)?.[1] ?? "";
        if (CLES_TOLEREES[cle]) continue;
        fautifs.push(`${f} · ${ligne.trim().slice(0, 90)}`);
      }
    }
    expect(fautifs).toEqual([]);
  });

  it("n'exempte que des fichiers qui existent encore", () => {
    // Une dispense qui ne désigne plus rien de vivant est du code mort qu'on a
    // fini par admettre : elle vieillit en silence et fait croire à une règle
    // qu'on ne vérifie plus.
    for (const f of Object.keys(VOUVOIENT)) expect(fichiers).toContain(f);
  });
});
