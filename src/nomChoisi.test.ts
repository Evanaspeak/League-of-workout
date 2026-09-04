import fs from "node:fs";
import path from "node:path";

/**
 * Le nom qu'on montre aux autres est CELUI QU'ILS ONT CHOISI (réponse 128).
 *
 * Le réglage ne vaut que s'il vaut PARTOUT. Un seul écran qui lit `pseudo` et
 * l'affiche tel quel publie le pseudo interne de quelqu'un qui a demandé son
 * pseudo Riot — ou, bien pire, l'inverse : le pseudo Riot de quelqu'un qui ne
 * l'a jamais demandé, c'est-à-dire une identité extérieure que n'importe qui
 * peut chercher ailleurs.
 *
 * Les tests par surface ne peuvent rien dire de la surface qu'on ajoutera
 * demain, et il s'en est ajouté quatre en une nuit — classement, dette
 * d'équipe, profil d'ami, profil public. Ce garde regarde donc le DOSSIER.
 *
 * La règle : tout fichier de `src/app` qui lit `pseudo` dans un `select`
 * Prisma applique `nomPublie`, ou figure ci-dessous avec sa raison.
 */

const RACINE = path.join(process.cwd(), "src", "app");

/**
 * Ce qui lit un pseudo sans avoir à appliquer le choix, et pourquoi.
 *
 * Deux familles, et une seule d'entre elles est évidente :
 *
 * - ce qui s'adresse à VOUS (courriel, récupération de code) : le nom montré
 *   aux autres n'a rien à y faire, c'est vous qu'on nomme ;
 * - l'ADMINISTRATION, qui agit sur les comptes et doit les reconnaître. Lui
 *   montrer le nom d'affichage rendrait un signalement impossible à rattacher
 *   à quelqu'un.
 */
const SANS_NOM_CHOISI: Record<string, string> = {
  "api/admin/users/route.ts":
    "administration : elle agit sur les comptes et doit les reconnaître par leur pseudo réel",
  "api/admin/mesures/route.ts":
    "administration : même raison",
  "api/admin/signalements/route.ts":
    "administration : rattacher un signalement à un compte demande son pseudo réel",
  "api/auth/forgot-code/route.ts":
    "s'adresse à vous : le courriel de récupération vous nomme, il ne vous montre à personne",
  "api/auth/reset-code/route.ts":
    "s'adresse à vous : même raison",
  "api/mail/hebdo/route.ts":
    "s'adresse à vous : le bilan hebdomadaire vous nomme dans votre propre courriel",
  "api/amis/route.ts":
    "la recherche par pseudo EXACT résout un pseudo en compte et le renvoie tel qu'il a été tapé ; la liste, elle, applique bien le choix",
};

function fichiers(dossier: string): string[] {
  return fs.readdirSync(dossier, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) return fichiers(p);
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [p] : [];
  });
}

describe("le nom montré aux autres", () => {
  const lecteurs = fichiers(RACINE)
    .map((chemin) => ({
      nom: path.relative(RACINE, chemin).replace(/\\/g, "/"),
      texte: fs.readFileSync(chemin, "utf8"),
    }))
    .filter((f) => /pseudo:\s*true/.test(f.texte));

  it("le recensement lit vraiment quelque chose", () => {
    // Sans ce témoin, un dossier renommé ou un motif devenu aveugle rendrait
    // la liste vide, et tous les contrôles passeraient au vert sur rien.
    expect(lecteurs.length).toBeGreaterThanOrEqual(8);
  });

  /**
   * Une route peut confier la mise en forme à un module de `src/lib` — c'est
   * ce que font le classement et la dette d'équipe, et c'est la bonne façon :
   * la décision vit à un seul endroit, éprouvable sans base ni serveur. Le
   * garde suit donc UN saut d'import, pas davantage : au-delà, il ne dirait
   * plus rien de précis et se contenterait de trouver le mot quelque part.
   */
  /**
   * `nomPublie(` et non `nomPublie` : la ligne d'IMPORT contient le mot.
   *
   * Éprouvé — en retirant l'appel du classement et en laissant l'import, le
   * garde restait vert. C'est le défaut déjà écrit ici pour le piège de focus
   * et pour la porte des routes : un garde qui reconnaît un import reconnaît
   * une intention, pas un comportement. Trois fois le même en une nuit.
   */
  const APPEL = /nomPublie\s*\(/;
  const appliqueLeChoix = (f: { texte: string }): boolean => {
    if (APPEL.test(f.texte)) return true;
    const imports = [...f.texte.matchAll(/from "@\/lib\/([\w/-]+)"/g)].map((m) => m[1]);
    return imports.some((mod) => {
      for (const ext of [".ts", ".tsx"]) {
        const chemin = path.join(process.cwd(), "src", "lib", mod + ext);
        if (fs.existsSync(chemin) && APPEL.test(fs.readFileSync(chemin, "utf8"))) return true;
      }
      return false;
    });
  };

  it("chaque lecture de pseudo applique le choix, ou dit pourquoi elle s'en dispense", () => {
    const oublies = lecteurs
      .filter((f) => !(f.nom in SANS_NOM_CHOISI))
      .filter((f) => !appliqueLeChoix(f))
      .map((f) => f.nom);
    expect(oublies).toEqual([]);
  });

  it("celles qui appliquent le choix lisent de quoi le faire", () => {
    // `nomPublie` sans `nomAffiche` au `select` rend toujours le pseudo : le
    // réglage serait appelé et n'aurait aucun effet, ce qui est pire qu'un
    // oubli — on croirait le tenir.
    const incomplets = lecteurs
      .filter((f) => !(f.nom in SANS_NOM_CHOISI))
      .filter(appliqueLeChoix)
      .filter((f) => !/nomAffiche:\s*true/.test(f.texte) || !/riotId:\s*true/.test(f.texte))
      .map((f) => f.nom);
    expect(incomplets).toEqual([]);
  });

  it("aucune dispense ne désigne un fichier disparu", () => {
    const mortes = Object.keys(SANS_NOM_CHOISI)
      .filter((nom) => !fs.existsSync(path.join(RACINE, nom)));
    expect(mortes).toEqual([]);
  });
});
