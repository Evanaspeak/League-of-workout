import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { sansCommentaires } from "./test/sansCommentaires";

/**
 * Un message d'ERREUR affiché doit être annoncé.
 *
 * Le journal porte TROIS occurrences du même défaut, en deux entrées, chacune
 * corrigée sur son écran et jamais gardée :
 *
 *   - le refus de connexion dans un `<div>` nu — « c'est l'écran où celui qui
 *     n'entre pas n'a aucun autre recours, et un lecteur d'écran n'y entendait
 *     rien du tout » ;
 *   - les messages du signalement et de la mise de côté d'un exercice,
 *     « annoncés à personne […] sous un bouton redevenu cliquable » ;
 *   - la suppression de compte en `role="status"`, qui est POLI, sur l'action
 *     la plus irréversible du produit.
 *
 * À chaque fois le message PARAÎT — on le lit à l'œil, et rien ne signale que
 * personne d'autre ne l'entend. C'est le refus silencieux sous sa forme la
 * plus discrète, et c'est pour ça qu'il revient.
 *
 * Le recensement du 10 septembre en a rendu dix de plus, dont les deux qui
 * comptent le plus : `/beta`, la SEULE porte d'entrée du produit, et
 * `/recuperation`, le seul chemin de retour pour qui n'entre plus. Les trois
 * écrans de porte partagent le même objet de style ; la correction de V547
 * n'en avait touché qu'un.
 *
 * Ce que le garde tient : tout état dont le NOM dit qu'il porte une erreur, et
 * qui est rendu dans du JSX, doit l'être dans un élément qui l'annonce — ou
 * figurer ci-dessous avec sa raison.
 *
 * Ce qu'il ne tient PAS, écrit plutôt que laissé à croire : il ne juge pas
 * entre `alert` (assertif) et `status` (poli). Le choix se lit dans
 * `ReglagesCorps` — « on attend ce message, il n'a aucun intérêt s'il attend
 * le prochain moment calme d'un lecteur d'écran » — et il demande de savoir si
 * la personne attend, ce qu'aucun motif ne dit.
 */

const RACINE = join(process.cwd(), "src");
const ANNONCE = ['role="alert"', "aria-live", 'role="status"'];

/**
 * Ce qu'un état doit RECEVOIR pour qu'on le tienne pour un message d'erreur.
 *
 * Le nom ne suffit pas, et c'est le recensement qui l'a dit : sept états sur
 * dix-sept ne s'appellent ni `erreur` ni `echec` mais `msg` ou `message`, et
 * portent le succès ET l'échec sous un drapeau (`type: "err"`, `ok: false`).
 * Un garde indexé sur le nom les aurait tous manqués — dont `CompteRiot`, le
 * seul écran où l'on relie son compte Riot, et `CorrectionDates`, dont le
 * message dit combien de dates ont RÉELLEMENT bougé.
 */
const RECOIT_UNE_ERREUR = /translateApiError|\.error\b|t\.echec|t\.erreur|type:\s*"err"|ok:\s*false/;

/** Aucune aujourd'hui, et c'est l'état sain : un garde qui naît avec une liste
 *  d'exemptions naît déjà usé. */
const DISPENSES: Record<string, string> = {};

function fichiersTsx(dossier: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dossier)) {
    const p = join(dossier, e);
    if (statSync(p).isDirectory()) out.push(...fichiersTsx(p));
    else if (e.endsWith(".tsx")) out.push(p);
  }
  return out;
}

/** Le `{ … }` équilibré qui commence en `i`. */
function bloc(src: string, i: number): string {
  let prof = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") prof++;
    else if (src[j] === "}") {
      prof--;
      if (prof === 0) return src.slice(i, j + 1);
    }
  }
  return src.slice(i, i + 600);
}

/**
 * La balise OUVRANTE qui englobe la position `p`.
 *
 * On remonte en comptant : une fermeture `</x>` creuse d'un cran, une balise
 * auto-fermante ne compte pas. Sans ce comptage, on rendrait la balise
 * précédente plutôt que le parent, et un `role` posé sur le parent passerait
 * pour absent.
 */
function baliseEnglobante(src: string, p: number): string {
  let prof = 0;
  let i = p;
  while (i > 0) {
    if (src[i] === ">") {
      const j = src.lastIndexOf("<", i);
      if (j < 0) return "";
      const frag = src.slice(j, i + 1);
      if (frag.startsWith("</")) prof++;
      else if (!frag.endsWith("/>")) {
        if (prof === 0) return frag;
        prof--;
      }
      i = j;
    } else i--;
  }
  return "";
}

type Rendu = { fichier: string; nom: string; annonce: boolean };

/** Les états d'erreur RENDUS d'un fichier, avec ce qu'on sait de leur annonce. */
export function rendusDErreur(source: string, fichier = "?"): Rendu[] {
  const src = sansCommentaires(source);
  const noms = new Set<string>();
  for (const m of src.matchAll(/const \[(\w+), (set\w+)\]/g)) {
    const [, nom, setter] = m;
    const parLeNom = /[Ee]rr|[Ee]rreur|[Ee]chec/.test(nom);
    const parLaPose = [...src.matchAll(new RegExp(setter + "\\(([^;]{0,140})", "g"))]
      .some((p) => RECOIT_UNE_ERREUR.test(p[1]));
    if (parLeNom || parLaPose) noms.add(nom);
  }
  const out: Rendu[] = [];
  for (const nom of [...noms].sort()) {
    const motif = new RegExp("\\{\\s*" + nom + "\\b(?!\\s*[=!<>])", "g");
    let annonce = false;
    let rendu = false;
    for (const m of src.matchAll(motif)) {
      const englobante = baliseEnglobante(src, m.index);
      if (!englobante) continue; // hors JSX : ce n'est pas un rendu
      rendu = true;
      const b = bloc(src, m.index);
      if (ANNONCE.some((a) => b.includes(a) || englobante.includes(a))) annonce = true;
    }
    if (rendu) out.push({ fichier, nom, annonce });
  }
  return out;
}

describe("un message d'erreur affiché est annoncé", () => {
  const fichiers = fichiersTsx(RACINE);
  const rendus = fichiers.flatMap((f) =>
    rendusDErreur(readFileSync(f, "utf8"), f.slice(process.cwd().length + 1)),
  );

  it("aucun état d'erreur rendu dans un élément muet", () => {
    const muets = rendus
      .filter((r) => !r.annonce && !DISPENSES[`${r.fichier}:${r.nom}`])
      .map((r) => `${r.fichier} — ${r.nom}`);
    expect(muets).toEqual([]);
  });

  it("une dispense désigne encore un état muet", () => {
    const vivantes = new Set(
      rendus.filter((r) => !r.annonce).map((r) => `${r.fichier}:${r.nom}`),
    );
    expect(Object.keys(DISPENSES).filter((c) => !vivantes.has(c))).toEqual([]);
  });

  // Témoin : un balayage qui ne trouve plus rien passerait au vert en
  // n'examinant aucun état. C'est la forme d'erreur que ce fichier surveille.
  it("le balayage examine encore quelque chose", () => {
    expect(fichiers.length).toBeGreaterThan(100);
    expect(rendus.length).toBeGreaterThanOrEqual(30);
  });
});

/*
  Le tri s'éprouve sur des cas FABRIQUÉS : l'état sain du dépôt est zéro
  trouvaille, donc les fichiers réels ne distinguent pas un tri juste d'un tri
  aveugle.
*/
describe("le tri distingue vraiment", () => {
  const cas = (jsx: string) =>
    rendusDErreur(`const [erreur, setErreur] = useState("");\nexport default function C() { return (${jsx}); }`);

  it("un message dans un élément nu est signalé", () => {
    expect(cas(`<div>{erreur && <p className="loss-text">{erreur}</p>}</div>`)[0].annonce).toBe(false);
  });

  it("role=alert sur l'élément du message passe", () => {
    expect(cas(`<div>{erreur && <p role="alert">{erreur}</p>}</div>`)[0].annonce).toBe(true);
  });

  it("role=alert sur la balise ENGLOBANTE passe", () => {
    expect(cas(`<div role="alert">{erreur}</div>`)[0].annonce).toBe(true);
  });

  it("aria-live passe", () => {
    expect(cas(`<div aria-live="polite">{erreur}</div>`)[0].annonce).toBe(true);
  });

  /*
    La forme que le nom seul ne voit pas : un état qui porte le succès ET
    l'échec sous un drapeau, et qui s'appelle `msg`. Sept des dix-sept défauts
    du recensement avaient cette forme.
  */
  it("un état nommé msg qui reçoit une erreur d'API est examiné", () => {
    const src = `const [msg, setMsg] = useState(null);
      function f(d) { setMsg({ type: "err", text: translateApiError(d.error, locale) }); }
      export default function C() { return (<div>{msg && <p>{msg.text}</p>}</div>); }`;
    const r = rendusDErreur(src);
    expect(r.map((x) => x.nom)).toEqual(["msg"]);
    expect(r[0].annonce).toBe(false);
  });

  it("un état ordinaire n'entre pas dans le champ", () => {
    const src = `const [pseudo, setPseudo] = useState("");
      export default function C() { return (<div>{pseudo}</div>); }`;
    expect(rendusDErreur(src)).toEqual([]);
  });

  it("une comparaison n'est pas un rendu", () => {
    expect(rendusDErreur(`const [erreur, setErreur] = useState(""); if ({erreur} === 1) {}`)).toEqual([]);
  });

  /*
    Le piège de ce garde-ci, et il est réel : la correction de `/beta` porte un
    commentaire qui CITE `role="alert"` pour dire pourquoi il est là. Un garde
    qui lirait le texte brut serait satisfait par sa propre explication.
  */
  it("un commentaire qui cite le motif ne suffit pas", () => {
    const src = `const [erreur, setErreur] = useState("");
      export default function C() {
        return (<div>{erreur && (
          /* on met role="alert" ici un jour */
          <p className="loss-text">{erreur}</p>
        )}</div>);
      }`;
    expect(rendusDErreur(src)[0].annonce).toBe(false);
  });
});
