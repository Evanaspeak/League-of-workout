"use client";
import { useCallback, useEffect, useState } from "react";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { amis as dictAmis } from "@/lib/i18n/dictionaries/amis";
import { translateApiError } from "@/lib/i18n/apiErrors";

/**
 * Les amis et les groupes.
 *
 * Deux principes gouvernent tout l'écran, et ils viennent de la réponse 127
 * (« es-tu prêt à modérer un espace social ? → Non ») :
 *
 *  * **rien ne se cherche.** Pas de champ de recherche, pas de suggestion, pas
 *    de liste de comptes. On tape un pseudo qu'on connaît déjà, ou on colle un
 *    code qu'on a reçu. L'écran le DIT, en tête de chaque section : quelqu'un
 *    qui cherche un annuaire doit apprendre qu'il n'y en a pas, plutôt que de
 *    le chercher.
 *  * **rien ne bouge à l'écran avant d'avoir bougé en base.** Poser la
 *    nouvelle valeur puis envoyer est le défaut déjà corrigé cinq fois sur ce
 *    projet — l'écran montre alors ce que le serveur n'a pas gardé, et on s'en
 *    aperçoit au rechargement suivant sans savoir pourquoi. Chaque geste
 *    attend la réponse, et un refus se dit.
 */

type Personne = { lien: string; id: string; pseudo: string };
type Groupe = {
  id: string; nom: string; code: string; membres: number; proprietaire: boolean;
};
type Donnees = {
  amis: Personne[];
  recues: Personne[];
  envoyees: Personne[];
  groupes: Groupe[];
};

export function AmisClient() {
  const t = useT(dictAmis);
  const { locale } = useLocale();

  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [echecChargement, setEchecChargement] = useState(false);
  /** Le geste en cours, par identifiant : un seul bouton s'éteint à la fois. */
  const [occupe, setOccupe] = useState<string | null>(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");
  /**
   * Ce qui attend une confirmation.
   *
   * Deux gestes, pas une bascule au clic : retirer un ami et quitter un groupe
   * sont irréversibles du point de vue de celui d'en face — il faudra
   * redemander. Une frappe malheureuse sur la ligne d'à côté ne doit pas
   * suffire. C'est la règle déjà posée pour la correction d'un résultat.
   */
  const [aConfirmer, setAConfirmer] = useState<string | null>(null);

  const [pseudo, setPseudo] = useState("");
  const [nomGroupe, setNomGroupe] = useState("");
  const [code, setCode] = useState("");
  const [copie, setCopie] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setEchecChargement(false);
    try {
      const res = await fetch("/api/amis");
      if (!res.ok) throw new Error(String(res.status));
      setDonnees(await res.json());
    } catch {
      /**
       * On ne remet pas `donnees` à zéro.
       *
       * Un rafraîchissement raté ne doit pas effacer ce qu'on avait : sinon un
       * geste fait dans le métro vide l'écran. C'est la leçon des trois
       * mémoires de module qui retenaient l'échec.
       */
      setEchecChargement(true);
    }
  }, []);

  useEffect(() => { charger(); }, [charger]);

  /**
   * Un geste : envoyer, attendre, dire ce qui s'est passé, recharger.
   *
   * Le rechargement n'est pas une paresse : la réponse d'une acceptation ne
   * porte pas la liste, et recalculer l'état ici en ferait une seconde vérité
   * — celle qui finit par différer de la base sans que rien ne le dise.
   */
  const agir = useCallback(async (
    cle: string,
    url: string,
    options: { method: string; body?: unknown },
    succes?: (data: Record<string, unknown>) => string,
  ) => {
    setOccupe(cle);
    setErreur("");
    setMessage("");
    try {
      const res = await fetch(url, {
        method: options.method,
        ...(options.body === undefined
          ? {}
          : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(options.body) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErreur(data.error ? translateApiError(String(data.error), locale) : t.erreurAction);
        return false;
      }
      if (succes) setMessage(succes(data));
      await charger();
      return true;
    } catch {
      setErreur(t.erreurAction);
      return false;
    } finally {
      setOccupe(null);
      setAConfirmer(null);
    }
  }, [charger, locale, t.erreurAction]);

  const demander = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await agir("demande", "/api/amis", { method: "POST", body: { pseudo } }, (d) =>
      d.etat === "acceptee" ? t.accepteeAvec(String(d.pseudo)) : t.envoyeeA(String(d.pseudo)));
    if (ok) setPseudo("");
  };

  const creerGroupe = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await agir("creer", "/api/groupes", { method: "POST", body: { nom: nomGroupe } });
    if (ok) setNomGroupe("");
  };

  const rejoindre = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await agir("rejoindre", "/api/groupes/rejoindre", { method: "POST", body: { code } },
      (d) => (d.deja ? t.dejaMembre : t.membres(Number(d.membres))));
    if (ok) setCode("");
  };

  const copier = async (valeur: string) => {
    try {
      await navigator.clipboard.writeText(valeur);
      setCopie(valeur);
    } catch {
      // Le presse-papiers demande une permission qui peut manquer, et le code
      // est écrit juste à côté : on ne dit rien plutôt que d'alarmer.
    }
  };

  if (!donnees) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="titre-page">{t.titre}</h1>
        {echecChargement ? (
          <div className="lol-panel p-5 space-y-3" role="alert">
            <p style={{ color: "var(--steel)" }}>{t.erreur}</p>
            <button type="button" className="lol-btn" onClick={charger}>{t.reessayer}</button>
          </div>
        ) : (
          /* Une hauteur réservée : sans elle, tout ce qui est visible saute
             quand la liste arrive. C'est le défaut mesuré à 0,252 de CLS sur
             l'historique, et la réserve est ce qui le corrige. */
          <div className="lol-panel p-5" role="status" style={{ minHeight: 420, color: "var(--steel)" }}>
            {t.chargement}
          </div>
        )}
      </main>
    );
  }

  const boutonRetrait = (
    cle: string, lien: string, question: string, libelle: string,
  ) => (
    aConfirmer === cle ? (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "var(--steel)", fontSize: ".85rem" }}>{question}</span>
        <button
          type="button"
          className="lol-btn"
          disabled={occupe === cle}
          onClick={() => agir(cle, `/api/${lien}`, { method: "DELETE" })}
        >
          {libelle}
        </button>
        <button type="button" className="lol-btn" onClick={() => setAConfirmer(null)}>
          {t.annuler}
        </button>
      </span>
    ) : (
      <button type="button" className="lol-btn" onClick={() => setAConfirmer(cle)}>
        {libelle}
      </button>
    )
  );

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <h1 className="titre-page">{t.titre}</h1>
        <p style={{ color: "var(--steel)", maxWidth: "60ch" }}>{t.sousTitre}</p>
      </header>

      {erreur && (
        <p className="lol-panel p-4" role="alert" style={{ color: "var(--loss)" }}>{erreur}</p>
      )}
      {message && (
        <p className="lol-panel p-4" role="status" style={{ color: "var(--win)" }}>{message}</p>
      )}
      {echecChargement && (
        <p className="lol-panel p-4" role="alert" style={{ color: "var(--steel)" }}>{t.erreur}</p>
      )}

      <section className="lol-panel p-5 space-y-3">
        <h2 style={{ fontFamily: "var(--font-heading)" }}>{t.ajouterTitre}</h2>
        <form onSubmit={demander} className="space-y-2">
          <label htmlFor="amis-pseudo" style={{ display: "block", fontSize: ".9rem" }}>
            {t.pseudoLabel}
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              id="amis-pseudo"
              className="lol-input"
              value={pseudo}
              onChange={(e) => setPseudo(e.target.value)}
              maxLength={24}
              autoComplete="off"
              style={{ flex: "1 1 12rem", minWidth: 0 }}
            />
            <button type="submit" className="lol-btn" disabled={occupe === "demande" || pseudo.trim().length < 2}>
              {occupe === "demande" ? t.envoi : t.ajouter}
            </button>
          </div>
          <p style={{ color: "var(--steel)", fontSize: ".8rem" }}>{t.pseudoAide}</p>
        </form>
      </section>

      {donnees.recues.length > 0 && (
        <section className="lol-panel p-5 space-y-3">
          <h2 style={{ fontFamily: "var(--font-heading)" }}>{t.recuesTitre}</h2>
          <ul className="space-y-2" style={{ listStyle: "none", padding: 0 }}>
            {donnees.recues.map((p) => (
              <li key={p.lien} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 8rem", minWidth: 0, overflowWrap: "anywhere" }}>{p.pseudo}</span>
                <button
                  type="button"
                  className="lol-btn"
                  disabled={occupe === `oui-${p.lien}`}
                  onClick={() => agir(`oui-${p.lien}`, `/api/amis/${p.lien}`, { method: "PATCH" })}
                >
                  {t.accepter}
                </button>
                <button
                  type="button"
                  className="lol-btn"
                  disabled={occupe === `non-${p.lien}`}
                  onClick={() => agir(`non-${p.lien}`, `/api/amis/${p.lien}`, { method: "DELETE" })}
                >
                  {t.refuser}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {donnees.envoyees.length > 0 && (
        <section className="lol-panel p-5 space-y-3">
          <h2 style={{ fontFamily: "var(--font-heading)" }}>{t.envoyeesTitre}</h2>
          <ul className="space-y-2" style={{ listStyle: "none", padding: 0 }}>
            {donnees.envoyees.map((p) => (
              <li key={p.lien} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 8rem", minWidth: 0, overflowWrap: "anywhere" }}>{p.pseudo}</span>
                <span style={{ color: "var(--steel)", fontSize: ".85rem" }}>{t.enAttente}</span>
                <button
                  type="button"
                  className="lol-btn"
                  disabled={occupe === `annule-${p.lien}`}
                  onClick={() => agir(`annule-${p.lien}`, `/api/amis/${p.lien}`, { method: "DELETE" })}
                >
                  {t.annuler}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="lol-panel p-5 space-y-3">
        <h2 style={{ fontFamily: "var(--font-heading)" }}>{t.listeTitre}</h2>
        {donnees.amis.length === 0 ? (
          <p style={{ color: "var(--steel)" }}>{t.listeVide}</p>
        ) : (
          <ul className="space-y-2" style={{ listStyle: "none", padding: 0 }}>
            {donnees.amis.map((p) => (
              <li key={p.lien} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ flex: "1 1 8rem", minWidth: 0, overflowWrap: "anywhere" }}>{p.pseudo}</span>
                {boutonRetrait(
                  `retire-${p.lien}`, `amis/${p.lien}`,
                  t.retirerConfirme(p.pseudo), t.retirer,
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <header className="space-y-2" style={{ paddingTop: 8 }}>
        <h2 className="titre-page" style={{ fontSize: "1.4rem" }}>{t.groupesTitre}</h2>
        <p style={{ color: "var(--steel)", maxWidth: "60ch" }}>{t.groupesSousTitre}</p>
      </header>

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))" }}>
        <section className="lol-panel p-5 space-y-3">
          <h3 style={{ fontFamily: "var(--font-heading)" }}>{t.creerTitre}</h3>
          <form onSubmit={creerGroupe} className="space-y-2">
            <label htmlFor="groupe-nom" style={{ display: "block", fontSize: ".9rem" }}>
              {t.nomLabel}
            </label>
            <input
              id="groupe-nom"
              className="lol-input"
              value={nomGroupe}
              onChange={(e) => setNomGroupe(e.target.value)}
              maxLength={30}
              autoComplete="off"
              style={{ width: "100%", maxWidth: "100%" }}
            />
            <button type="submit" className="lol-btn" disabled={occupe === "creer" || nomGroupe.trim().length < 2}>
              {occupe === "creer" ? t.creation : t.creer}
            </button>
          </form>
        </section>

        <section className="lol-panel p-5 space-y-3">
          <h3 style={{ fontFamily: "var(--font-heading)" }}>{t.rejoindreTitre}</h3>
          <form onSubmit={rejoindre} className="space-y-2">
            <label htmlFor="groupe-code" style={{ display: "block", fontSize: ".9rem" }}>
              {t.codeLabel}
            </label>
            <input
              id="groupe-code"
              className="lol-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={16}
              autoComplete="off"
              spellCheck={false}
              style={{ width: "100%", maxWidth: "100%", fontFamily: "ui-monospace, monospace", letterSpacing: ".08em" }}
            />
            <button type="submit" className="lol-btn" disabled={occupe === "rejoindre" || code.trim().length < 8}>
              {occupe === "rejoindre" ? t.rejointe : t.rejoindre}
            </button>
            <p style={{ color: "var(--steel)", fontSize: ".8rem" }}>{t.codeAide}</p>
          </form>
        </section>
      </div>

      <section className="lol-panel p-5 space-y-4">
        {donnees.groupes.length === 0 ? (
          <p style={{ color: "var(--steel)" }}>{t.groupesVides}</p>
        ) : (
          <ul className="space-y-4" style={{ listStyle: "none", padding: 0 }}>
            {donnees.groupes.map((g) => (
              <li key={g.id} className="space-y-2" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                  <strong style={{ overflowWrap: "anywhere" }}>{g.nom}</strong>
                  <span style={{ color: "var(--steel)", fontSize: ".85rem" }}>{t.membres(g.membres)}</span>
                  {g.proprietaire && (
                    <span style={{ color: "var(--gold)", fontSize: ".8rem" }}>{t.proprietaire}</span>
                  )}
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ color: "var(--steel)", fontSize: ".85rem" }}>{t.codeDuGroupe}</span>
                  <code style={{ fontFamily: "ui-monospace, monospace", letterSpacing: ".12em" }}>{g.code}</code>
                  <button
                    type="button"
                    className="lol-btn"
                    onClick={() => copier(g.code)}
                    aria-label={`${t.copier} ${g.nom}`}
                  >
                    {copie === g.code ? t.copie : t.copier}
                  </button>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {g.proprietaire && (
                    <button
                      type="button"
                      className="lol-btn"
                      disabled={occupe === `code-${g.id}`}
                      onClick={() => agir(`code-${g.id}`, `/api/groupes/${g.id}`, { method: "PATCH" })}
                      title={t.refaireCodeAide}
                    >
                      {t.refaireCode}
                    </button>
                  )}
                  {boutonRetrait(
                    `quitte-${g.id}`, `groupes/${g.id}`,
                    g.membres <= 1 ? t.quitterDernier(g.nom) : t.quitterConfirme(g.nom),
                    t.quitter,
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
