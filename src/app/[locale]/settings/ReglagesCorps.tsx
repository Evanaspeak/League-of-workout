"use client";
import { fetchBorne } from "@/lib/reseau";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useT, useNombre, useLocale } from "@/lib/i18n/LocaleContext";
import { settings as settingsDict } from "@/lib/i18n/dictionaries/settings";
import { translateApiError } from "@/lib/i18n/apiErrors";
import {
  MULTIPLICATEURS, imc, masseGrasse, mesuresCompletes, objectifCalorique,
  type FormuleCalorique, type ModeCalorique, type NiveauActivite,
} from "@/lib/objectifCalorique";
import { KCAL_MAX, objectifMesure } from "@/lib/depenseJour";

/**
 * La rubrique « Ton corps » : l'objectif calorique et le mètre-ruban.
 *
 * Étape 05 du plan. Elle vit dans son propre fichier pour la raison qui avait
 * fait sortir « Avancé » : `settings/page.tsx` fait déjà sept cent quatre-vingts
 * lignes, et celles-ci ne partagent avec le reste que le poids, la taille et
 * l'âge — qui sont déjà des états de la page.
 *
 * **Réponse 014, « visible mais discret » :** une rubrique dans la liste des
 * réglages, comme les autres. Pas un onglet de navigation, pas une carte sur le
 * tableau de bord. Quelqu'un qui vient pour le jeu doit pouvoir l'ignorer toute
 * sa vie sans jamais buter dessus.
 *
 * **Réponse 013, « une option qu'on active » :** tout est éteint tant qu'aucun
 * mode n'est choisi, et c'est le mode qui sert d'interrupteur — pas un booléen
 * de plus qui pourrait le contredire.
 */

/**
 * La courbe est chargée à la demande : `recharts` pèse cent kilo-octets, et la
 * page des réglages n'a aucune raison de les porter pour les comptes qui
 * n'ouvriront jamais cette rubrique. `ssr: false` parce qu'elle mesure son
 * conteneur, ce que le serveur ne peut pas faire.
 */
const CourbePoids = dynamic(
  () => import("@/components/CourbePoids").then((m) => m.CourbePoids),
  { ssr: false, loading: () => <div style={{ height: 180 }} /> },
);

/**
 * Le jour LOCAL, celui du navigateur.
 *
 * `toISOString` rendrait le jour UTC : une saisie faite à six heures du matin
 * à Tokyo se rangerait sur la veille, et la dépense du jour ne nourrirait
 * l'objectif de personne. La règle est la même que pour une pesée, et elle
 * vit maintenant une seule fois plutôt que deux.
 */
function jourLocalNavigateur(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const ACTIVITES = Object.keys(MULTIPLICATEURS) as NiveauActivite[];
const MODES: ModeCalorique[] = ["perte", "maintien", "prise"];

export type CorpsPrefs = {
  formuleCalorique: FormuleCalorique | null;
  niveauActivite: NiveauActivite | null;
  modeCalorique: ModeCalorique | null;
  poidsCible: number | null;
  tourTaille: number | null;
  tourCou: number | null;
  tourHanches: number | null;
  rappelPeseeActif: boolean;
  /**
   * Porte-t-elle une montre (réponse 035) ? TROIS états : `null` est « pas
   * répondu », qui n'est pas « non ».
   */
  montre: boolean | null;
};

export function ReglagesCorps({
  prefs, setPrefs, poids, taille, age, enregistrer,
}: {
  prefs: CorpsPrefs;
  setPrefs: (maj: (p: CorpsPrefs) => CorpsPrefs) => void;
  poids: number | null;
  taille: number | null;
  age: number | null;
  /**
   * Le même chemin d'enregistrement que le reste de la page.
   *
   * Il porte quatre règles qui ont chacune leur raison écrite là-bas : le
   * `try` autour de l'envoi, le message d'échec, le retour à la valeur d'avant
   * quand le serveur refuse, et l'indicateur d'attente. Écrire un second
   * enregistrement ici les aurait recopiées toutes les quatre — et c'est le
   * motif que ce projet paie en boucle.
   */
  enregistrer: (userPrefs: Record<string, unknown>, revenir: () => void) => Promise<unknown>;
}) {
  const t = useT(settingsDict);
  // Un objectif de calories est TOUJOURS à quatre chiffres : « 2207 kcal »
  // s'affichait ainsi dans les six langues, là où le français écrit
  // « 2 207 » et l'allemand « 2.207 ».
  const nombre = useNombre();
  /**
   * Une décimale, et elle passe par `Intl`.
   *
   * `${n}` rend « 24.7 » dans les six langues. Le français et
   * l'espagnol écrivent « 24,7 », et en allemand le POINT est le
   * séparateur des milliers : « 24.7 » s'y lit comme vingt-quatre mille
   * sept. Ce n'est pas de la typographie, c'est un chiffre faux.
   */
  const decimal = useNombre({ maximumFractionDigits: 1 });
  const { locale } = useLocale();
  const [peseeKg, setPeseeKg] = useState("");
  const [peseeEtat, setPeseeEtat] = useState<"" | "envoi" | "ok" | "echec">("");
  const [pesees, setPesees] = useState<{ jour: string; grammes: number }[] | null>(null);
  /**
   * `null` veut dire « pas encore lu », pas « aucune pesée ».
   *
   * La distinction compte : une courbe vide affichée pendant le chargement
   * dirait « tu ne t'es jamais pesé » à quelqu'un qui a deux ans
   * d'historique — et c'est le défaut déjà corrigé sur l'historique des
   * parties, qui annonçait « aucune game » quand la requête échouait.
   */
  const [lectureRatee, setLectureRatee] = useState(false);

  /**
   * La dépense relevée sur une montre (ligne 040 du plan).
   *
   * `depenseErreur` porte le message de la ROUTE, traduit, et non un
   * « erreur d'enregistrement » générique. C'est tout le sujet : le refus qui
   * compte ici dit LEQUEL des deux chiffres de la montre on attend, et le
   * remplacer par un message uniforme enverrait retaper le même nombre.
   */
  const [depenseKcal, setDepenseKcal] = useState("");
  const [depenseEtat, setDepenseEtat] = useState<"" | "envoi" | "ok" | "echec">("");
  const [depenseErreur, setDepenseErreur] = useState("");
  const [depenses, setDepenses] = useState<{ jour: string; kcalBrulees: number }[]>([]);

  useEffect(() => {
    fetchBorne("/api/pesees")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("lecture"))))
      .then((d) => setPesees(Array.isArray(d?.pesees) ? d.pesees : []))
      .catch(() => setLectureRatee(true));
  }, []);

  useEffect(() => {
    fetchBorne("/api/depense")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("lecture"))))
      .then((d) => setDepenses(Array.isArray(d?.depenses) ? d.depenses : []))
      // Une lecture ratée laisse la liste vide : l'objectif retombe alors sur
      // l'ESTIMATION, c'est-à-dire sur le comportement d'avant cette ligne.
      // Un repli ne doit jamais promettre plus que ce qu'on a mesuré.
      .catch(() => {});
  }, []);

  /** Enregistre un réglage en revenant en arrière si le serveur refuse. */
  const poser = <K extends keyof CorpsPrefs>(cle: K, valeur: CorpsPrefs[K]) => {
    const avant = prefs[cle];
    setPrefs((p) => ({ ...p, [cle]: valeur }));
    void enregistrer({ [cle]: valeur }, () => setPrefs((p) => ({ ...p, [cle]: avant })));
  };

  const mesures = {
    formule: prefs.formuleCalorique ?? undefined,
    poids: poids ?? undefined,
    taille: taille ?? undefined,
    age: age ?? undefined,
    activite: prefs.niveauActivite ?? undefined,
  };
  /**
   * La dépense relevée AUJOURD'HUI, si elle existe.
   *
   * Le jour vient du navigateur, comme celui qu'on envoie : chercher avec un
   * jour UTC ferait manquer sa propre saisie du matin selon le fuseau, et
   * l'objectif retomberait sur l'estimation sans que rien ne le dise.
   */
  const jour = jourLocalNavigateur();
  const depenseDuJour = depenses.find((d) => d.jour === jour)?.kcalBrulees ?? null;

  /**
   * Réponse 041, « elle nourrit l'objectif » : la mesure REMPLACE l'estimation
   * pour le jour où elle existe.
   *
   * `objectifCalorique` part du métabolisme de base multiplié par un facteur
   * d'activité choisi dans une liste, c'est-à-dire d'une devinette. Quand une
   * montre a mesuré la journée, la garder serait un journal et pas un
   * objectif. Les deux avertissements suivent la valeur AFFICHÉE et non
   * l'estimation : c'est ce chiffre-là qu'on va manger.
   */
  const objectif = prefs.modeCalorique && mesuresCompletes(mesures)
    ? (depenseDuJour !== null
      ? objectifMesure(mesures, prefs.modeCalorique, depenseDuJour)
      : objectifCalorique(mesures, prefs.modeCalorique))
    : null;

  const graisse = prefs.formuleCalorique && taille && prefs.tourTaille && prefs.tourCou
    ? masseGrasse(prefs.formuleCalorique, taille, prefs.tourTaille, prefs.tourCou, prefs.tourHanches)
    : null;

  /** A-t-on commencé à remplir le mètre-ruban ? La taille en fait partie. */
  const rubanEntame = Boolean(
    prefs.tourTaille || prefs.tourCou || prefs.tourHanches || taille,
  );

  /**
   * Enregistre une pesée.
   *
   * Elle ne passe PAS par `/api/settings` : une pesée est une ligne du
   * registre, pas un réglage. Le poids part en GRAMMES, comme la colonne le
   * demande, parce que quelqu'un qui se pèse à 78,4 kg doit pouvoir l'écrire.
   */
  const peser = async () => {
    const kg = Number(peseeKg.replace(",", "."));
    if (!Number.isFinite(kg) || kg <= 0) { setPeseeEtat("echec"); return; }
    setPeseeEtat("envoi");
    try {
      const res = await fetchBorne("/api/pesees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grammes: Math.round(kg * 1000),
          jour: jourLocalNavigateur(),
        }),
      });
      // Un 500 ou une session expirée traversent `if (res.ok)` sans rien dire :
      // la saisie disparaîtrait en silence, ce que ce projet corrige en boucle.
      setPeseeEtat(res.ok ? "ok" : "echec");
      if (res.ok) {
        setPeseeKg("");
        // La route rend la courbe entière : la relire serait un aller-retour
        // pour une réponse qu'on tient déjà.
        const d = await res.json().catch(() => null);
        if (Array.isArray(d?.pesees)) { setPesees(d.pesees); setLectureRatee(false); }
      }
    } catch {
      setPeseeEtat("echec");
    }
  };

  /**
   * Enregistre la dépense du jour.
   *
   * Le message de refus vient de la ROUTE, traduit, et jamais d'un texte
   * générique. La route distingue deux refus qui ne se corrigent pas de la
   * même façon : un chiffre absurde se retape, une valeur sous le métabolisme
   * de base est presque toujours les calories ACTIVES à la place du total. Un
   * « erreur d'enregistrement » uniforme ferait retaper le même nombre.
   */
  const noterDepense = async () => {
    const kcal = Number(depenseKcal.replace(",", "."));
    if (!Number.isFinite(kcal) || kcal <= 0) {
      setDepenseEtat("echec");
      setDepenseErreur(t.erreurSauvegarde);
      return;
    }
    setDepenseEtat("envoi");
    setDepenseErreur("");
    try {
      const res = await fetchBorne("/api/depense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kcalBrulees: Math.round(kcal), jour: jourLocalNavigateur() }),
      });
      setDepenseEtat(res.ok ? "ok" : "echec");
      const d = await res.json().catch(() => null);
      if (res.ok) {
        setDepenseKcal("");
        // La route rend la liste entière : la relire serait un aller-retour
        // pour une réponse qu'on tient déjà.
        if (Array.isArray(d?.depenses)) setDepenses(d.depenses);
      } else {
        setDepenseErreur(d?.error ? translateApiError(d.error, locale) : t.erreurSauvegarde);
      }
    } catch {
      setDepenseEtat("echec");
      setDepenseErreur(t.erreurSauvegarde);
    }
  };

  const indice = poids && taille ? imc(poids, taille) : null;

  return (
    <div className="space-y-6">
      {/*
        L'aide de la rubrique vit AU-DESSUS du premier panneau, pas dedans.
        Elle portait un `<h2>` qui répétait mot pour mot le titre rendu par
        `EnteteRubrique` : « TON CORPS » s'affichait deux fois de suite, ce
        qu'aucune autre rubrique ne fait — chez les voisines, chaque panneau se
        nomme pour ce qu'il EST (« Test de force », « Tes exercices »). Deux
        titres de même niveau et de même texte se lisent aussi deux fois pour
        un lecteur d'écran.
      */}
      <p className="text-xs" style={{ color: "var(--faint)" }}>{t.corpsAide}</p>

      <div className="lol-panel space-y-4">

        {/*
          Le MODE est l'interrupteur. Un booléen séparé pourrait le contredire —
          « activé » avec aucun mode, ou l'inverse — et il faudrait alors
          décider lequel des deux fait foi.
        */}
        <div>
          {/*
            Un `<label>` seul devant une rangée de boutons n'étiquette rien :
            il n'a pas de contrôle à désigner, et un lecteur d'écran le lit
            comme un texte quelconque. Le groupe se nomme donc lui-même.
          */}
          <div id="corps-mode-titre" className="text-xs" style={{ color: "var(--muted)" }}>{t.corpsMode}</div>
          <div role="group" aria-labelledby="corps-mode-titre" className="flex gap-2 flex-wrap mt-2">
            <button
              className="py-2 px-3 rounded text-sm"
              aria-pressed={prefs.modeCalorique === null}
              style={boutonStyle(prefs.modeCalorique === null)}
              onClick={() => poser("modeCalorique", null)}
            >
              {t.corpsModeEteint}
            </button>
            {MODES.map((m) => (
              <button
                key={m}
                className="py-2 px-3 rounded text-sm"
                aria-pressed={prefs.modeCalorique === m}
                style={boutonStyle(prefs.modeCalorique === m)}
                onClick={() => poser("modeCalorique", m)}
              >
                {t.corpsModes[m]}
              </button>
            ))}
          </div>
        </div>

        {prefs.modeCalorique && (
          <>
            <div>
              <div id="corps-formule-titre" className="text-xs" style={{ color: "var(--muted)" }}>{t.corpsFormule}</div>
              <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.corpsFormuleAide}</p>
              <div role="group" aria-labelledby="corps-formule-titre" className="flex gap-2 mt-2">
                {(["h", "f"] as FormuleCalorique[]).map((f) => (
                  <button
                    key={f}
                    className="py-2 px-3 rounded text-sm"
                    aria-pressed={prefs.formuleCalorique === f}
                    style={boutonStyle(prefs.formuleCalorique === f)}
                    onClick={() => poser("formuleCalorique", f)}
                  >
                    {t.corpsFormules[f]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="corps-activite" className="text-xs" style={{ color: "var(--muted)" }}>{t.corpsActivite}</label>
              <select
                id="corps-activite"
                className="lol-select w-full mt-2"
                value={prefs.niveauActivite ?? ""}
                onChange={(e) => poser("niveauActivite", (e.target.value || null) as NiveauActivite | null)}
              >
                <option value="">{t.corpsActiviteVide}</option>
                {ACTIVITES.map((a) => (
                  <option key={a} value={a}>{t.corpsActivites[a]}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="corps-poids-cible" className="text-xs" style={{ color: "var(--muted)" }}>{t.corpsPoidsCible}</label>
              <input
                id="corps-poids-cible"
                type="number" inputMode="numeric" min={20} max={500}
                className="lol-input w-full mt-2"
                value={prefs.poidsCible ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  setPrefs((p) => ({ ...p, poidsCible: v }));
                }}
                onBlur={() => poser("poidsCible", prefs.poidsCible)}
              />
            </div>

            {/*
              L'objectif, et les deux avertissements qui ne l'empêchent JAMAIS
              de s'afficher (réponses 017 et 018). Refuser d'afficher pousserait
              à aller chercher le chiffre ailleurs, sans l'avertissement.
            */}
            {objectif ? (
              <div className="space-y-2" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                <div className="mono-num font-bold" style={{ fontSize: "1.6rem" }}>
                  {t.corpsObjectifValeur(nombre(objectif.cible))}
                </div>
                <div className="text-xs" style={{ color: "var(--faint)" }}>
                  {t.corpsMaintienValeur(nombre(objectif.maintien))}
                  {objectif.imc !== null && ` · ${t.corpsImc(decimal(objectif.imc))}`}
                </div>
                {/*
                  D'où vient le chiffre. Sans cette ligne, l'objectif change
                  d'un jour à l'autre sans que rien ne l'explique, et on
                  cherche l'erreur dans ses mesures.
                */}
                {depenseDuJour !== null && (
                  <p className="text-xs" style={{ color: "var(--faint)" }}>{t.corpsDepenseMesuree}</p>
                )}
                {objectif.sousPlancher && (
                  <p role="note" className="text-xs" style={{ color: "var(--loss)" }}>
                    {t.corpsAvertPlancher}
                  </p>
                )}
                {objectif.imcBas && (
                  <p role="note" className="text-xs" style={{ color: "var(--loss)" }}>
                    {t.corpsAvertImc}
                  </p>
                )}
                {/*
                  Aucune date, aucun « dans X semaines » (réponse 016). La règle
                  des 7 700 kcal par kilo est fausse, et une échéance chiffrée
                  est crue précisément parce qu'elle est chiffrée. On dit
                  pourquoi plutôt que de laisser un vide qu'on prendrait pour un
                  oubli.
                */}
                <p className="text-xs" style={{ color: "var(--faint)" }}>{t.corpsPasDeDate}</p>
              </div>
            ) : (
              <p className="text-xs" style={{ color: "var(--faint)" }}>{t.corpsIncomplet}</p>
            )}
          </>
        )}
      </div>

      {/* ── La dépense relevée sur une montre (ligne 040) ───────────────── */}
      <div className="lol-panel space-y-3">
        <div>
          <h2 className="titre-section">{t.corpsDepenseTitre}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.corpsDepenseAide}</p>
        </div>
        {/*
          La question de la ligne 035, posée là où elle sert : juste au-dessus
          du champ qu'elle gouverne.

          Deux boutons et pas trois : « je ne réponds pas » n'est pas un geste
          qu'on fait, c'est l'état de départ — il se voit à ce qu'aucun des
          deux n'est pressé.

          Et la réponse ne CACHE rien. Le champ reste là quelle qu'elle soit :
          « je ne porte pas de montre » n'est pas « je ne veux pas saisir ma
          dépense », et une balance connectée ou un calcul à la main donnent le
          même chiffre. Retirer le champ sur la foi de cette case serait plus
          restrictif que ce qu'on a demandé.
        */}
        <div
          className="flex items-center justify-between gap-3 flex-wrap"
          role="group"
          aria-labelledby="montre-label"
        >
          <div id="montre-label" className="text-sm">{t.corpsMontreLabel}</div>
          <div className="flex gap-2">
            <button
              className="py-2 px-3 rounded text-sm"
              aria-pressed={prefs.montre === true}
              style={boutonStyle(prefs.montre === true)}
              onClick={() => poser("montre", true)}
            >
              {t.corpsMontreOui}
            </button>
            <button
              className="py-2 px-3 rounded text-sm"
              aria-pressed={prefs.montre === false}
              style={boutonStyle(prefs.montre === false)}
              onClick={() => poser("montre", false)}
            >
              {t.corpsMontreNon}
            </button>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <input
            type="number" inputMode="numeric" step="10" min={1} max={KCAL_MAX}
            className="lol-input flex-1"
            aria-label={t.corpsDepenseLabel}
            value={depenseKcal}
            onChange={(e) => { setDepenseKcal(e.target.value); setDepenseEtat(""); setDepenseErreur(""); }}
          />
          <button className="lol-btn" disabled={depenseEtat === "envoi"} onClick={noterDepense}>
            {depenseEtat === "envoi" ? t.enregistrementEnCours : t.corpsDepenseEnregistrer}
          </button>
        </div>
        {depenseEtat === "ok" && (
          <p role="status" className="text-xs" style={{ color: "var(--victory)" }}>{t.enregistre}</p>
        )}
        {/*
          `role="alert"` et non `status` : ce refus DIT lequel des deux chiffres
          de la montre on attend, et il n'a aucun intérêt s'il attend le
          prochain moment calme d'un lecteur d'écran.
        */}
        {depenseEtat === "echec" && depenseErreur && (
          <p role="alert" className="text-xs" style={{ color: "var(--loss)" }}>{depenseErreur}</p>
        )}
        {depenseDuJour !== null && (
          <p className="text-xs" style={{ color: "var(--faint)" }}>
            {t.corpsDepenseAujourdhui(nombre(depenseDuJour))}
          </p>
        )}
        {/*
          Ce qu'on n'a pas encore fait, dit là où on peut le faire.
          Elle porte une montre, et l'objectif tourne encore sur l'ESTIMATION :
          c'est le seul moment où cette phrase apprend quelque chose. Notée,
          elle disparaît.
        */}
        {prefs.montre === true && depenseDuJour === null && (
          <p className="text-xs" style={{ color: "var(--steel)" }}>
            {t.corpsMontreRappel}
          </p>
        )}
      </div>

      {/* ── Le suivi du poids (réponse 021) ─────────────────────────────── */}
      <div className="lol-panel space-y-3">
        <div>
          <h2 className="titre-section">{t.corpsPeseeTitre}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.corpsPeseeAide}</p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="number" inputMode="decimal" step="0.1" min={20} max={500}
            className="lol-input flex-1"
            aria-label={t.corpsPeseeLabel}
            value={peseeKg}
            onChange={(e) => { setPeseeKg(e.target.value); setPeseeEtat(""); }}
          />
          <button className="lol-btn" disabled={peseeEtat === "envoi"} onClick={peser}>
            {peseeEtat === "envoi" ? t.enregistrementEnCours : t.corpsPeseeEnregistrer}
          </button>
        </div>
        {peseeEtat === "ok" && (
          <p role="status" className="text-xs" style={{ color: "var(--victory)" }}>{t.enregistre}</p>
        )}
        {peseeEtat === "echec" && (
          <p role="alert" className="text-xs" style={{ color: "var(--loss)" }}>{t.erreurSauvegarde}</p>
        )}
        {indice !== null && (
          <p className="text-xs" style={{ color: "var(--faint)" }}>{t.corpsImc(decimal(indice))}</p>
        )}

        {/*
          Deux points au minimum : une courbe d'un seul point est un point, et
          l'afficher promet une tendance qui n'existe pas encore.
        */}
        {pesees && pesees.length >= 2 && (
          <CourbePoids
            points={pesees.map((p) => ({ jour: p.jour, kg: p.grammes / 1000 }))}
            formaterJour={(j) => j.slice(5)}
            formaterPoids={(kg) => t.corpsPeseeValeur(decimal(kg))}
          />
        )}
        {pesees && pesees.length === 1 && (
          <p className="text-xs" style={{ color: "var(--faint)" }}>{t.corpsCourbeUnePesee}</p>
        )}
        {/*
          Le rappel hebdomadaire (réponse 022 : OPTIONNEL). Éteint par défaut,
          et il ne dit rien du poids — c'est un rappel de geste, pas un
          jugement. Une notification qui commente est une notification qu'on
          coupe, et on coupe tout avec.
        */}
        <div className="flex items-center justify-between gap-3" style={{ borderTop: "1px solid var(--line)", paddingTop: 12 }}>
          <div>
            <div className="text-sm">{t.corpsRappelLabel}</div>
            <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.corpsRappelAide}</p>
          </div>
          <button
            className="py-2 px-3 rounded text-sm"
            aria-pressed={prefs.rappelPeseeActif}
            style={boutonStyle(prefs.rappelPeseeActif)}
            onClick={() => poser("rappelPeseeActif", !prefs.rappelPeseeActif)}
          >
            {prefs.rappelPeseeActif ? t.corpsRappelOui : t.corpsRappelNon}
          </button>
        </div>

        {lectureRatee && (
          <p role="alert" className="text-xs" style={{ color: "var(--loss)" }}>
            {t.corpsCourbeEchec}
          </p>
        )}
      </div>

      {/* ── Le mètre-ruban (réponse 023, en option) ─────────────────────── */}
      <div className="lol-panel space-y-3">
        <div>
          <h2 className="titre-section">{t.corpsRubanTitre}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--faint)" }}>{t.corpsRubanAide}</p>
        </div>
        {([
          ["tourTaille", t.corpsTourTaille],
          ["tourCou", t.corpsTourCou],
          ["tourHanches", t.corpsTourHanches],
        ] as const).map(([cle, libelle]) => (
          <div key={cle}>
            <label htmlFor={`corps-${cle}`} className="text-xs" style={{ color: "var(--muted)" }}>{libelle}</label>
            <input
              id={`corps-${cle}`}
              type="number" inputMode="numeric" min={15} max={300}
              className="lol-input w-full mt-1"
              value={prefs[cle] ?? ""}
              onChange={(e) => {
                const v = e.target.value === "" ? null : Number(e.target.value);
                setPrefs((p) => ({ ...p, [cle]: v }));
              }}
              onBlur={() => poser(cle, prefs[cle])}
            />
          </div>
        ))}
        {/*
          Ce qui manque ne se dit qu'à partir du moment où l'on a commencé.
          Les trois champs vides, « il manque une mesure » est le dernier mot
          du panneau à la PREMIÈRE ouverture : c'est-à-dire un reproche pour ne
          pas avoir commencé, à l'instant qui décide si l'on s'en servira. Le
          paragraphe d'aide juste au-dessus dit déjà quoi faire. C'est la règle
          déjà posée pour l'objectif de première semaine — un objectif raté
          qu'on laisse affiché n'est plus un objectif.
        */}
        {graisse !== null ? (
          <p className="mono-num" style={{ fontSize: "1.2rem" }}>{t.corpsMasseGrasse(decimal(graisse))}</p>
        ) : rubanEntame ? (
          <p className="text-xs" style={{ color: "var(--faint)" }}>{t.corpsRubanIncomplet}</p>
        ) : null}
      </div>

      {/*
        La photo avant-après (réponse 154).

        La réponse est un REFUS doublé d'une consigne : « non, trop risqué —
        inciter à le faire pour eux, mais jamais transmis à l'application ».
        Il n'y a donc rien à construire ici, et c'est le sujet : la seule chose
        à faire est de le DIRE, et de ne jamais ouvrir de chemin qui reçoive
        une image. `src/aucunePhoto.test.ts` tient la seconde moitié.
      */}
      <div className="lol-panel space-y-2">
        <h2 className="titre-section">{t.corpsPhotoTitre}</h2>
        <p className="text-xs" style={{ color: "var(--faint)", lineHeight: 1.6 }}>
          {t.corpsPhotoAide}
        </p>
      </div>
    </div>
  );
}

function boutonStyle(actif: boolean): React.CSSProperties {
  return actif
    ? { background: "var(--gold)", color: "#0b0d12", border: "1px solid var(--gold)" }
    : { background: "color-mix(in srgb, var(--steel) 10%, transparent)", color: "var(--muted)", border: "1px solid color-mix(in srgb, var(--steel) 20%, transparent)" };
}
