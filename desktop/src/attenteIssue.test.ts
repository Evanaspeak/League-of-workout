
// Fait de ce fichier un MODULE : sans ça, TypeScript le traite comme un
// script et ses noms de premier niveau entrent dans la portée globale, où
// ils entrent en collision avec ceux d'un autre fichier de test. Jest ne
// s'en aperçoit pas — chaque fichier y a sa propre portée — c'est `tsc` qui
// le dit.
export {};
// Les deux garanties de l'attente : la partie part toujours, et jamais deux
// fois. Tout le reste en découle.

const { creerAttenteFin } = require("./attenteIssue");

type FinDePartie = { type: string; partie: { score?: unknown; resultat?: string | null; motifSansResultat?: string } };

const score = { kills: 5, deaths: 2, assists: 7 };
const fin = (resultat: string | null): FinDePartie => ({ type: "game-ended", partie: { score, resultat } });

function monter(delaiMs = 30000, avanceMs = 60000) {
  const envois: FinDePartie[] = [];
  let differe: (() => void) | null = null;
  const attente = creerAttenteFin({
    envoyer: (e: FinDePartie) => envois.push(e),
    delaiMs,
    avanceMs,
    poser: (f: () => void) => { differe = f; return 1; },
    retirer: () => { differe = null; },
  });
  return { attente, envois, echoir: () => { const f = differe; differe = null; f?.(); } };
}

describe("l'attente de l'écran de fin", () => {
  it("laisse passer tout de suite une partie dont l'issue est déjà lue", () => {
    const { attente, envois } = monter();
    attente.finDePartie(fin("V"));
    expect(envois).toHaveLength(1);
    expect(envois[0].partie.resultat).toBe("V");
    expect(attente.enAttente()).toBe(false);
  });

  it("retient une partie sans issue, et la complète quand le lanceur parle", () => {
    const { attente, envois } = monter();
    attente.finDePartie(fin(null));
    expect(envois).toHaveLength(0);
    attente.issue({ resultat: "V", motif: null });
    expect(envois).toHaveLength(1);
    expect(envois[0].partie.resultat).toBe("V");
  });

  it("rend la main même si le lanceur ne dit jamais rien", () => {
    // C'est la garantie qui compte : une attente qui n'échoit pas perd la
    // partie sans que rien ne le signale.
    const { attente, envois, echoir } = monter();
    attente.finDePartie(fin(null));
    echoir();
    expect(envois).toHaveLength(1);
    expect(envois[0].partie.resultat).toBeNull();
  });

  it("n'envoie pas la partie deux fois quand le lanceur parle puis que le délai échoit", () => {
    const { attente, envois, echoir } = monter();
    attente.finDePartie(fin(null));
    attente.issue({ resultat: "D", motif: null });
    echoir();
    expect(envois).toHaveLength(1);
  });

  it("n'envoie rien à la seule réception d'une issue : il n'y a pas de partie", () => {
    const { attente, envois } = monter();
    attente.issue({ resultat: "V", motif: null });
    expect(envois).toHaveLength(0);
  });

  it("garde une issue arrivée avant la fin de partie, et l'applique", () => {
    // Les deux sources ne se suivent pas dans un ordre garanti : rien
    // n'interdit au lanceur de basculer pendant que le jeu s'attarde. L'issue
    // arrivait alors sans partie à compléter, et se perdait pour de bon.
    const { attente, envois } = monter();
    attente.issue({ resultat: "V", motif: null });
    attente.finDePartie(fin(null));
    expect(envois).toHaveLength(1);
    expect(envois[0].partie.resultat).toBe("V");
    expect(attente.enAttente()).toBe(false);
  });

  it("ne resert pas la même issue à la partie suivante", () => {
    // Elle vaut pour UNE partie : la resservir prêterait à la seconde un
    // résultat qui n'est pas le sien, ce qui est exactement le défaut qu'on
    // vient de corriger, à l'envers.
    const { attente, envois } = monter();
    attente.issue({ resultat: "V", motif: null });
    attente.finDePartie(fin(null));
    attente.finDePartie(fin(null));
    expect(envois).toHaveLength(1);
    expect(attente.enAttente()).toBe(true);
  });

  it("oublie une issue trop vieille", () => {
    // Une réponse d'il y a dix minutes ne parle pas de la partie qui vient de
    // finir.
    const { attente, envois } = monter(30000, 0);
    attente.issue({ resultat: "V", motif: null });
    attente.finDePartie(fin(null));
    expect(envois).toHaveLength(0);
    expect(attente.enAttente()).toBe(true);
  });


  it("garde le motif quand le lanceur dit qu'il n'y a pas d'issue", () => {
    const { attente, envois } = monter();
    attente.finDePartie(fin(null));
    attente.issue({ resultat: null, motif: "remake" });
    expect(envois[0].partie.resultat).toBeNull();
    expect(envois[0].partie.motifSansResultat).toBe("remake");
  });

  it("ne retient pas une partie sans relevé : il n'y a rien à compléter", () => {
    const { attente, envois } = monter();
    attente.finDePartie({ type: "game-ended", partie: {} });
    expect(envois).toHaveLength(1);
  });

  it("ne perd pas la première partie quand une seconde se termine avant la réponse", () => {
    const { attente, envois } = monter();
    attente.finDePartie(fin(null));
    attente.finDePartie(fin(null));
    expect(envois).toHaveLength(1);
    attente.issue({ resultat: "V", motif: null });
    expect(envois).toHaveLength(2);
  });

  it("laisse partir ce qui attend quand l'application se ferme", () => {
    const { attente, envois } = monter();
    attente.finDePartie(fin(null));
    attente.arreter();
    expect(envois).toHaveLength(1);
    attente.arreter();
    expect(envois).toHaveLength(1);
  });
});
