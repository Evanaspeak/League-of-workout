// Les deux garanties de l'attente : la partie part toujours, et jamais deux
// fois. Tout le reste en découle.

const { creerAttenteFin } = require("./attenteIssue");

type FinDePartie = { type: string; partie: { score?: unknown; resultat?: string | null; motifSansResultat?: string } };

const score = { kills: 5, deaths: 2, assists: 7 };
const fin = (resultat: string | null): FinDePartie => ({ type: "game-ended", partie: { score, resultat } });

function monter(delaiMs = 30000) {
  const envois: FinDePartie[] = [];
  let differe: (() => void) | null = null;
  const attente = creerAttenteFin({
    envoyer: (e: FinDePartie) => envois.push(e),
    delaiMs,
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

  it("ignore une issue qui arrive alors que rien n'attend", () => {
    const { attente, envois } = monter();
    attente.issue({ resultat: "V", motif: null });
    expect(envois).toHaveLength(0);
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
