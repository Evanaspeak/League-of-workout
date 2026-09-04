"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT, useLocale } from "@/lib/i18n/LocaleContext";
import { amis as dictAmis } from "@/lib/i18n/dictionaries/amis";
import { translateApiError } from "@/lib/i18n/apiErrors";
import { jourLocal } from "@/lib/serie";
import type { LigneClassement, Periode } from "@/lib/classement";
import type { MurDesRecords } from "@/lib/records";
import { JOURS_CLASSEMENT, PERIODE_DEFAUT, PERIODES } from "@/lib/classement";
import DetteEquipe from "./DetteEquipe";

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

/**
 * L'adresse d'invitation.
 *
 * Elle passe par `/beta` SANS préfixe de langue, et c'est délibéré : le
 * middleware négocie alors la langue de celui qui l'ouvre, plutôt que
 * d'imposer celle de celui qui a copié le lien. Quelqu'un qui partage sur un
 * serveur international ne veut pas envoyer tout le monde sur une page
 * française.
 */
function lienInvitation(code: string): string {
  const origine = typeof window === "undefined" ? "" : window.location.origin;
  return `${origine}/beta?p=${code}`;
}

type Profil = {
  partage: "total" | "detail";
  pseudo: string;
  points: number;
  enRetard: boolean;
  joursDeRetard: number;
  parties?: number;
  serie?: number;
  meilleureSerie?: number;
  jeuFavori?: string | null;
};

type Personne = { lien: string; id: string; pseudo: string };
type Groupe = {
  id: string; nom: string; code: string; membres: number; proprietaire: boolean;
};
type Classement = {
  lignes: LigneClassement[];
  records?: MurDesRecords;
  recordsOuverts?: MurDesRecords | null;
  jours: number;
  ecart: number | null;
  periode?: Periode;
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
  /**
   * Le classement vit à part de la liste, et son échec aussi.
   *
   * Les deux réponses n'ont pas la même conséquence : sans la liste il n'y a
   * plus d'écran, sans le classement il manque un tableau. Les mêler ferait
   * disparaître les amis parce qu'une somme n'a pas pu se faire.
   */
  const [classement, setClassement] = useState<Classement | null>(null);
  /**
   * La SEMAINE au départ, jamais le cumul (réponse 144).
   *
   * Un cumul est décidé par la date d'inscription : le premier arrivé a un
   * total que personne ne rattrape, et le dernier venu regarde un tableau où
   * sa place ne dépend plus de ce qu'il fait. Ouvrir dessus reviendrait à
   * montrer d'abord celui des deux qui décourage.
   */
  const [periode, setPeriode] = useState<Periode>(PERIODE_DEFAUT);
  /**
   * L'onglet ouvert, lisible depuis un rappel stable.
   *
   * Le classement se recharge de trois autres endroits — au montage, au
   * rafraîchissement de la dette, après avoir accepté une demande — et tous
   * trois passeraient sinon la période par DÉFAUT. Le tableau reviendrait à la
   * semaine sous un onglet qui dit « cumul », ce qui est le pire des deux
   * mondes : l'écran se contredit lui-même et rien ne le signale.
   */
  const periodeRef = useRef<Periode>(PERIODE_DEFAUT);
  const [parrainage, setParrainage] = useState<{ code: string | null; filleuls: number } | null>(null);
  /**
   * Le profil ouvert, s'il y en a un.
   *
   * Un seul à la fois : deux panneaux dépliés côte à côte sur une liste de
   * cent amis donnent un écran qu'on ne parcourt plus. `null` pendant le
   * chargement, `"erreur"` quand il n'a pas pu être lu — l'absence de réponse
   * se dit, elle ne se confond pas avec un profil vide.
   */
  const [profilOuvert, setProfilOuvert] = useState<string | null>(null);
  const [profil, setProfil] = useState<Profil | "erreur" | null>(null);
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

  const chargerClassement = useCallback(async (quelle: Periode = periodeRef.current) => {
    try {
      const res = await fetch(`/api/classement?jour=${jourLocal()}&periode=${quelle}`);
      if (!res.ok) throw new Error(String(res.status));
      setClassement(await res.json());
    } catch {
      // On garde ce qu'on avait : un rafraîchissement raté n'efface pas un
      // tableau juste. C'est la règle des trois mémoires de module.
    }
  }, []);

  /**
   * Ouvre le profil d'un ami, ou le referme.
   *
   * Rechargé à chaque ouverture plutôt que mis en cache : le réglage de
   * partage d'en face peut avoir changé entre-temps, et montrer un détail
   * qu'on n'autorise plus serait le pire moment pour servir une valeur
   * périmée.
   */
  const ouvrirProfil = useCallback(async (id: string) => {
    if (profilOuvert === id) { setProfilOuvert(null); setProfil(null); return; }
    setProfilOuvert(id);
    setProfil(null);
    try {
      const res = await fetch(`/api/amis/${id}/profil`);
      if (!res.ok) throw new Error(String(res.status));
      setProfil(await res.json());
    } catch {
      setProfil("erreur");
    }
  }, [profilOuvert]);

  const chargerParrainage = useCallback(async () => {
    try {
      const res = await fetch("/api/parrainage");
      if (!res.ok) throw new Error(String(res.status));
      setParrainage(await res.json());
    } catch {
      // Le lien manquant ne coûte que le lien : le reste de l'écran vit sa vie.
    }
  }, []);

  useEffect(() => {
    charger();
    chargerClassement();
    chargerParrainage();
  }, [charger, chargerClassement, chargerParrainage]);

  /**
   * Payer sa dette change sa propre ligne, et le compteur qui sert à payer est
   * dans le rail de CETTE page. Sans cette reprise, on paie sa séance et le
   * classement continue d'annoncer le total d'avant.
   */
  useEffect(() => {
    const relire = () => { chargerClassement(); };
    window.addEventListener("wow-dette-changee", relire);
    return () => window.removeEventListener("wow-dette-changee", relire);
  }, [chargerClassement]);

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
      // Accepter une demande ajoute une ligne au classement : recharger l'une
      // sans l'autre laisserait un ami visible et absent du tableau.
      await Promise.all([charger(), chargerClassement()]);
      return true;
    } catch {
      setErreur(t.erreurAction);
      return false;
    } finally {
      setOccupe(null);
      setAConfirmer(null);
    }
  }, [charger, chargerClassement, locale, t.erreurAction]);

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
    /**
     * L'attente MIROITE le rendu chargé, position par position.
     *
     * React réconcilie par POSITION dans l'arbre : deux `<main>` dont les
     * enfants ne s'alignent pas font démonter puis remonter tout ce qui est
     * dedans. Les paragraphes déjà peints sont alors recréés, et le repeint
     * tardif devient un nouveau candidat au plus grand élément — mesuré ici à
     * 2964 ms sur téléphone bridé, contre 1652 ms quand `/api/amis` est
     * bloquée, donc quand le remontage n'a jamais lieu.
     *
     * Les six premières positions sont donc les mêmes des deux côtés :
     * l'en-tête, les trois messages, le panneau du classement, celui du
     * parrainage. Ce qui suit dépend vraiment de la réponse et n'a rien à
     * mirroiter — des blocs vides y réservent la place, ce qui est l'autre
     * moitié du problème.
     */
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

        {/*
          Le titre et la phrase d'explication ne dépendent d'AUCUNE donnée :
          ils disent ce que l'écran fait, pas ce qu'il contient. Ce composant
          étant rendu au serveur avant d'être hydraté, ils partent dans le
          HTML servi — et le plus grand élément de la page cesse d'attendre la
          réponse.
        */}
        <section className="lol-panel p-5 space-y-3" style={{ minHeight: 220 }}>
          <h2 style={{ fontFamily: "var(--font-heading)" }}>{t.classementTitre}</h2>
          {/*
            Les onglets sont là aussi, et ce n'est pas de la décoration : React
            apparie les enfants par RANG. Sans eux, la phrase d'aide est le
            deuxième enfant ici et le troisième là-bas — donc appariée à autre
            chose, donc recréée, donc repeinte tard. C'est exactement ce qui
            faisait 2976 ms au lieu de 1652.
          */}
          <div role="tablist" aria-label={t.classementTitre} style={{ display: "flex", gap: 8 }}>
            {PERIODES.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={periode === p}
                disabled
                className="lol-btn"
                style={{ fontSize: ".8rem", padding: "4px 12px", opacity: periode === p ? 1 : 0.55 }}
              >
                {p === "semaine" ? t.ongletSemaine : t.ongletTotal}
              </button>
            ))}
          </div>
          <p style={{ color: "var(--steel)", fontSize: ".85rem", maxWidth: "60ch" }}>
            {t.classementAide(JOURS_CLASSEMENT)}
          </p>
        </section>

        {/*
          Le mur des records occupe le MÊME rang qu'en bas, et c'est tout ce
          qu'on lui demande ici. Sans lui, le panneau du parrainage était
          sixième d'un côté et septième de l'autre — donc apparié à autre
          chose, donc recréé, donc repeint tard. Mesuré : 3032 ms au lieu de
          1116. C'est la deuxième fois que la même section ajoutée au milieu
          décale ce qui la suit.
        */}
        <section className="lol-panel p-5 space-y-3" style={{ minHeight: 120 }}>
          <h2 style={{ fontFamily: "var(--font-heading)" }}>{t.recordsTitre}</h2>
          <p style={{ color: "var(--steel)", fontSize: ".85rem" }}>{t.recordsAucun}</p>
        </section>

        <section className="lol-panel p-5 space-y-3" style={{ minHeight: 200 }}>
          <h2 style={{ fontFamily: "var(--font-heading)" }}>{t.parrainageTitre}</h2>
          <p style={{ color: "var(--steel)", fontSize: ".85rem", maxWidth: "60ch" }}>
            {t.parrainageAide}
          </p>
        </section>

        {echecChargement ? (
          <div className="lol-panel p-5 space-y-3" role="alert">
            <button type="button" className="lol-btn" onClick={charger}>{t.reessayer}</button>
          </div>
        ) : (
          /**
           * La réserve du reste, en STRUCTURE et non en un nombre.
           *
           * Un bloc unique de 420 pixels vivait ici, posé en s'inspirant de
           * l'historique. L'écran a gagné depuis le classement, le parrainage,
           * les groupes et deux onglets : la page mesure 1883 pixels, la
           * réserve en tenait 420, et tout ce qui est visible sautait —
           * 0,145 de CLS mesuré, pour un seuil de 0,1. Une réserve écrite
           * comme un nombre vieillit avec l'écran, et personne ne pense à la
           * rouvrir quand on ajoute un panneau.
           */
          <div className="space-y-4" role="status" aria-label={t.chargement}>
            {[230, 300, 280].map((h, i) => (
              <div key={i} className="lol-panel p-5" style={{ minHeight: h }} aria-hidden="true" />
            ))}
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

      {/*
        Le classement passe AVANT le formulaire d'ajout : c'est ce pour quoi on
        revient, quand l'ajout est ce qu'on fait une fois. Sur un compte neuf
        il tient en une ligne, la sienne, et dit pourquoi il est vide — ce qui
        est la meilleure explication de ce que le formulaire sert à faire.
      */}
      {/*
        Le panneau est TOUJOURS rendu, et seul son tableau attend la
        réponse. Le laisser apparaître d'un bloc le ferait démonter puis
        remonter à l'arrivée des données, et les paragraphes déjà peints
        seraient recréés — c'est ce qui repoussait le plus grand élément
        de 1652 à 2964 ms sur téléphone bridé.
      */}
      <section className="lol-panel p-5 space-y-3">
          <h2 style={{ fontFamily: "var(--font-heading)" }}>{t.classementTitre}</h2>
          {/*
            Deux onglets, et le libellé d'aide suit celui qui est ouvert : une
            phrase qui parle de sept jours sous un tableau cumulatif serait
            fausse, et c'est le genre de faux qu'on ne relit jamais.
          */}
          <div role="tablist" aria-label={t.classementTitre} style={{ display: "flex", gap: 8 }}>
            {PERIODES.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={periode === p}
                onClick={() => { setPeriode(p); periodeRef.current = p; void chargerClassement(p); }}
                className="lol-btn"
                style={{
                  fontSize: ".8rem", padding: "4px 12px",
                  opacity: periode === p ? 1 : 0.55,
                }}
              >
                {p === "semaine" ? t.ongletSemaine : t.ongletTotal}
              </button>
            ))}
          </div>
          {/*
            La phrase d'aide reste HORS du conditionnel, et à la même
            profondeur que dans le rendu d'attente. C'est elle, le plus grand
            élément de la page : la faire descendre d'un cran la fait démonter
            et remonter à l'arrivée des données, et le repeint tardif redevient
            le plus grand élément. Le nombre de jours vient du classement quand
            il est là, de la constante sinon — c'est la même valeur.
          */}
          <p style={{ color: "var(--steel)", fontSize: ".85rem", maxWidth: "60ch" }}>
            {periode === "total"
              ? t.classementAideTotal
              : t.classementAide(classement?.jours ?? JOURS_CLASSEMENT)}
          </p>
          {classement ? (
            <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "var(--steel)", fontSize: ".8rem", textAlign: "left" }}>
                    <th scope="col" style={{ padding: "4px 8px 4px 0", width: "3rem" }}>{t.colRang}</th>
                    <th scope="col" style={{ padding: "4px 8px 4px 0" }}>{t.colJoueur}</th>
                    <th scope="col" style={{ padding: "4px 0", textAlign: "right" }}>{t.colEffort}</th>
                  </tr>
                </thead>
                <tbody>
                  {classement.lignes.map((l) => (
                    <tr
                      key={l.id}
                      style={{
                        borderTop: "1px solid var(--panel-border, rgba(255,255,255,.08))",
                        // Sa propre ligne se retrouve d'un coup d'œil dans une
                        // liste de cent : c'est la seule qu'on vient y chercher.
                        fontWeight: l.moi ? 700 : 400,
                      }}
                    >
                      <td style={{ padding: "8px 8px 8px 0", fontVariantNumeric: "tabular-nums" }}>
                        {l.rang}
                      </td>
                      <td style={{ padding: "8px 8px 8px 0", overflowWrap: "anywhere" }}>
                        {l.pseudo}
                        {l.enRetard && (
                          /* La pression sociale de la réponse 116, et elle
                             s'écrit sous le pseudo plutôt qu'à côté : à 320 px,
                             deux textes sur la même ligne poussent la colonne
                             des points hors de l'écran. */
                          <span style={{ display: "block", color: "var(--loss)", fontSize: ".78rem" }}>
                            {t.retardDepuis(l.joursDeRetard)}
                          </span>
                        )}
                      </td>
                      <td style={{
                        padding: "8px 0", textAlign: "right",
                        fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
                      }}>
                        {t.effortPaye(l.points)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {classement.lignes.length <= 1 ? (
              <p style={{ color: "var(--steel)", fontSize: ".85rem" }}>{t.classementSeul}</p>
            ) : classement.ecart !== null && (
              <p style={{ color: "var(--steel)", fontSize: ".85rem" }}>
                {classement.ecart === 0 ? t.enTete : t.ecartAuPremier(classement.ecart)}
              </p>
            )}
            </>
          ) : (
            /* La place du tableau, réservée : sans elle le panneau grandit
               d'un coup et pousse tout ce qui suit. */
            <div style={{ minHeight: 160 }} aria-hidden="true" />
          )}
      </section>

      {/*
        Le mur des records (ligne 140), sous le classement et pas dedans.
        Les deux ne disent pas la même chose : le classement additionne une
        fenêtre, le mur retient une POINTE — la plus grosse soirée. Les mêler
        ferait un second ordre sur les mêmes pseudos, ce qui n'apprend rien et
        double la place.
      */}
      <section className="lol-panel p-5 space-y-3">
          <h2 style={{ fontFamily: "var(--font-heading)" }}>{t.recordsTitre}</h2>
          {!classement?.records || (!classement.records.mois && !classement.records.toujours) ? (
            <p style={{ color: "var(--steel)", fontSize: ".85rem" }}>{t.recordsAucun}</p>
          ) : (
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
              {([["recordsMois", classement.records.mois], ["recordsToujours", classement.records.toujours]] as const)
                .map(([cle, r]) => (
                  <div key={cle}>
                    <dt style={{ color: "var(--steel)", fontSize: ".85rem" }}>
                      {cle === "recordsMois" ? t.recordsMois : t.recordsToujours}
                    </dt>
                    <dd style={{ margin: 0, overflowWrap: "anywhere" }}>
                      {r
                        ? (
                          <span style={{ color: r.moi ? "var(--gold)" : undefined }}>
                            {t.recordsLigne(r.pseudo, r.points, r.jour)}
                          </span>
                        )
                        : <span style={{ color: "var(--steel)" }}>{"\u2014"}</span>}
                    </dd>
                  </div>
                ))}
            </dl>
          )}
          {/*
            Le mur OUVERT, quand quelqu'un a choisi d'y figurer (réponse 141).
            Il est sous celui du cercle et pas à sa place : les deux ne
            répondent pas à la même question — « qui, parmi mes amis » et
            « qui, sur tout le produit » — et le second n'a de sens que quand
            il y a du monde. Rien ne s'affiche tant que personne n'a ouvert le
            sien : une section vide dirait « il n'y a personne », alors que la
            vérité est « personne n'a choisi de figurer ici ».
          */}
          {classement?.recordsOuverts && (classement.recordsOuverts.mois || classement.recordsOuverts.toujours) && (
            <div style={{ borderTop: "1px solid var(--line, rgba(255,255,255,.08))", paddingTop: 12 }}>
              <h3 className="titre-section" style={{ fontSize: "0.95rem" }}>{t.recordsOuvertsTitre}</h3>
              <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 8 }}>
                {([["recordsMois", classement.recordsOuverts.mois], ["recordsToujours", classement.recordsOuverts.toujours]] as const)
                  .map(([cle, r]) => (
                    <div key={cle}>
                      <dt style={{ color: "var(--steel)", fontSize: ".85rem" }}>
                        {cle === "recordsMois" ? t.recordsMois : t.recordsToujours}
                      </dt>
                      <dd style={{ margin: 0, overflowWrap: "anywhere" }}>
                        {r
                          ? (
                            <span style={{ color: r.moi ? "var(--gold)" : undefined }}>
                              {t.recordsLigne(r.pseudo, r.points, r.jour)}
                            </span>
                          )
                          : <span style={{ color: "var(--steel)" }}>{"\u2014"}</span>}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
      </section>

      {/*
        Le lien d'invitation, sous le classement.
        L'ordre raconte quelque chose : on voit d'abord ce qu'un classement
        donne, puis les deux façons de le remplir — inviter quelqu'un du
        dehors, ou ajouter quelqu'un qui est déjà là.
      */}
      <section className="lol-panel p-5 space-y-3">
          <h2 style={{ fontFamily: "var(--font-heading)" }}>{t.parrainageTitre}</h2>
          <p style={{ color: "var(--steel)", fontSize: ".85rem", maxWidth: "60ch" }}>
            {t.parrainageAide}
          </p>
          {!parrainage ? (
            /* La place du lien, réservée le temps de la réponse. */
            <div style={{ minHeight: 74 }} aria-hidden="true" />
          ) : parrainage.code ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                {/*
                  L'adresse se construit dans le navigateur : le serveur ne
                  connaît pas le domaine sous lequel la page est servie, et une
                  constante écrite en dur serait fausse en local comme sur un
                  déploiement de contrôle.
                */}
                <code style={{
                  fontFamily: "ui-monospace, monospace",
                  overflowWrap: "anywhere", flex: "1 1 12rem", minWidth: 0,
                }}>
                  {lienInvitation(parrainage.code)}
                </code>
                <button
                  type="button"
                  className="lol-btn"
                  onClick={() => copier(lienInvitation(parrainage.code!))}
                >
                  {copie === lienInvitation(parrainage.code) ? t.parrainageCopie : t.parrainageCopier}
                </button>
              </div>
              <p style={{ color: "var(--steel)", fontSize: ".85rem" }}>
                {t.parrainageFilleuls(parrainage.filleuls)}
              </p>
            </>
          ) : (
            <p role="alert" style={{ color: "var(--loss)", fontSize: ".85rem" }}>
              {t.parrainageIndisponible}
            </p>
          )}
      </section>

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
              <li key={p.lien} className="space-y-2">
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ flex: "1 1 8rem", minWidth: 0, overflowWrap: "anywhere" }}>{p.pseudo}</span>
                  <button
                    type="button"
                    className="lol-btn"
                    aria-expanded={profilOuvert === p.id}
                    onClick={() => ouvrirProfil(p.id)}
                  >
                    {t.voirProfil}
                  </button>
                  {boutonRetrait(
                    `retire-${p.lien}`, `amis/${p.lien}`,
                    t.retirerConfirme(p.pseudo), t.retirer,
                  )}
                </div>
                {profilOuvert === p.id && (
                  <div style={{
                    fontSize: ".85rem", color: "var(--steel)",
                    paddingLeft: 4, borderLeft: "2px solid rgba(152,162,176,0.25)",
                  }}>
                    {profil === null && <span role="status">{t.chargement}</span>}
                    {profil === "erreur" && <span role="alert">{t.profilErreur}</span>}
                    {profil && profil !== "erreur" && (
                      <div className="space-y-1">
                        <div>{t.effortPaye(profil.points)}</div>
                        {profil.enRetard && (
                          <div style={{ color: "var(--loss)" }}>{t.retardDepuis(profil.joursDeRetard)}</div>
                        )}
                        {profil.partage === "detail" ? (
                          <>
                            <div>{t.profilParties(profil.parties ?? 0)}</div>
                            <div>
                              {t.profilSerie(profil.serie ?? 0)} · {t.profilMeilleure(profil.meilleureSerie ?? 0)}
                            </div>
                            {profil.jeuFavori && (
                              <div>{profil.jeuFavori} · {t.profilJeu}</div>
                            )}
                          </>
                        ) : (
                          /* Le dire plutôt que d'afficher un panneau vide :
                             un écran qui ne montre rien sans expliquer
                             pourquoi passe pour une panne. */
                          <div>{t.profilFerme}</div>
                        )}
                      </div>
                    )}
                  </div>
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

                <DetteEquipe groupeId={g.id} nom={g.nom} />

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
