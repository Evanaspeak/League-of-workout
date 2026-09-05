"use client";
import { useEffect, useRef, useState } from "react";
import { useT, useLocale, etiquetteLocale } from "@/lib/i18n/LocaleContext";
import { bilanSaison as dictBilan } from "@/lib/i18n/dictionaries/bilanSaison";
import { effortPaye as dictEffort } from "@/lib/i18n/dictionaries/effortPaye";
import { JOURS_SAISON } from "@/lib/bilanSaison";
import { ventiler } from "@/lib/exercices";

/**
 * Le bilan de saison.
 *
 * L'application ne sait dire que le présent — ce qu'on doit, là, maintenant.
 * Trois mois mis bout à bout disent autre chose, et c'est la seule chose qu'on
 * ait envie de montrer à quelqu'un.
 *
 * L'image est rendue au serveur, pas capturée ici : une capture dépend de la
 * taille de la fenêtre, du thème et des polices installées, et rend une image
 * différente à chaque appareil.
 */
type Bilan = {
  debut: string; fin: string;
  parties: number; victoires: number; winrate: number | null;
  pointsDus: number; pointsPayes: number;
  joursActifs: number; meilleureSerie: number;
  pireJour: { jour: string; points: number } | null;
  jeuPrincipal: { nom: string; parties: number } | null;
  championPrincipal: { nom: string; parties: number } | null;
  repartitionPayee: Record<string, number>;
};

/**
 * Une case du bilan : une légende, une valeur.
 *
 * La police à chasse fixe ne sert qu'aux valeurs qui sont **des nombres**.
 * Posée sur toutes, elle donnait « League of Legends » et « 23 août » à la
 * machine à écrire, et surtout elle les élargit : « 21 + 2 min 20 » passait à
 * la ligne au milieu, et « Champion le plus joué » n'avait plus la place de
 * s'écrire. La chasse fixe existe pour aligner des chiffres entre eux, pas
 * pour faire joli.
 */
function Case({ legende, valeur }: { legende: string; valeur: string }) {
  // Un nombre nu, et rien d'autre. « 40 % » en est un aussi, mais l'espace
  // fine que le français impose devant le signe occupe une chasse entière en
  // police à chasse fixe : le trou se voit à l'écran. Ces cases ne sont pas
  // une colonne de chiffres à aligner, elles n'y perdent rien.
  const chiffree = /^[\d.,]+$/.test(valeur);
  return (
    <div className="lol-panel" style={{ padding: "14px 16px" }}>
      <div style={{
        fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.13em",
        color: "var(--steel)",
      }}>
        {legende}
      </div>
      <div className={chiffree ? "mono-num" : undefined} style={{
        // Une valeur longue rétrécit plutôt que de passer à la ligne au
        // milieu : « 21 + 2 min 20 » se coupait entre « min » et « 20 ».
        fontSize: valeur.length > 12 ? "1.2rem" : "1.6rem",
        fontWeight: 700, color: "var(--amber)", marginTop: 4, lineHeight: 1.15,
        // Une valeur qui déborde se coupe au mot, jamais au milieu.
        overflowWrap: "anywhere",
      }}>
        {valeur}
      </div>
    </div>
  );
}

export function BilanClient({ aDesParties }: { aDesParties: boolean }) {
  const t = useT(dictBilan);
  const tEffort = useT(dictEffort);
  const locale = useLocale();
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [erreur, setErreur] = useState(false);
  /**
   * L'image ne s'est pas dessinée.
   *
   * Sans ce cas, la page montrait l'icône de fichier cassé du navigateur, et
   * le bouton « ouvrir » emmenait sur une page d'erreur brute. Or ce qui a
   * échoué n'est pas le bilan : les chiffres sont là, à côté. C'est la seule
   * phrase qui compte ici.
   */
  const [imageKO, setImageKO] = useState(false);
  /**
   * `onError` ne suffit pas.
   *
   * L'image part avec le HTML et peut échouer AVANT l'hydratation : React
   * n'attache son écouteur qu'après, et l'erreur est alors passée sans témoin.
   * Le repli ne s'affichait jamais — le test l'a trouvé, pas la relecture.
   *
   * Une image déjà terminée le dit : `complete` est vrai et `naturalWidth`
   * vaut zéro. On regarde donc à la première occasion, en plus d'écouter.
   */
  const imageRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = imageRef.current;
    if (img && img.complete && img.naturalWidth === 0) setImageKO(true);
  });

  useEffect(() => {
    let vivant = true;
    fetch("/api/bilan")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((b) => { if (vivant) setBilan(b); })
      .catch(() => { if (vivant) setErreur(true); });
    return () => { vivant = false; };
  }, []);

  // Les nombres et les dates passent par `Intl` : une table de séparateurs
  // écrite à la main se trompe de langue tôt ou tard.
  const etiquette = etiquetteLocale(locale.locale);
  const nombre = (n: number) => new Intl.NumberFormat(etiquette).format(n);
  /**
   * Le pourcentage passe par `Intl`, pas par un « % » recollé à la main.
   * Le français exige une espace fine insécable avant le signe, l'anglais n'en
   * veut aucune : écrit à la main, on a l'un des deux faux, et en chasse fixe
   * l'espace ordinaire creuse un trou visible.
   */
  const pourcent = (n: number) =>
    new Intl.NumberFormat(etiquette, { style: "percent" }).format(n / 100);
  const date = (jour: string) => {
    const [a, m, j] = jour.split("-").map(Number);
    return new Intl.DateTimeFormat(etiquette, { day: "numeric", month: "long" })
      .format(new Date(Date.UTC(a, m - 1, j)));
  };

  /**
   * L'image, rendue sans attendre les chiffres.
   *
   * Elle ne dépend d'aucun d'eux : le serveur la dessine à partir de la base,
   * et la seule chose à savoir avant de poser la balise est s'il y a des
   * parties — ce que la page serveur a déjà compté. Gatée sur la réponse de
   * l'API, elle ne commençait à se charger qu'après le JavaScript,
   * l'hydratation et un aller-retour : 3628 ms sur téléphone bridé, le seul
   * écran au-dessus du seuil. Le préchargement l'amène à 2043 ms, la balise
   * dans le HTML la rend visible dès qu'elle arrive.
   */
  const blocImage = (
    <div className="lol-panel p-5 space-y-3">
      <div style={{
        fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.13em",
        color: "var(--steel)",
      }}>
        {t.imageTitre}
      </div>
      {/* L'image vient d'une route qui exige la session : c'est une donnée du
          compte, même si elle est faite pour être montrée. `<img>` plutôt que
          `next/image` — la source est générée à chaque appel et n'a rien à
          faire dans un cache d'images. */}
      {imageKO ? (
        <p role="status" style={{ color: "var(--loss)", fontSize: "0.85rem", margin: 0 }}>
          {t.imageErreur}
        </p>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imageRef}
            src="/api/bilan/image"
            alt={t.imageAlt}
            width={1200}
            height={630}
            onError={() => setImageKO(true)}
            style={{ width: "100%", height: "auto", borderRadius: 8, display: "block" }}
          />
          {/* Le bouton disparaît avec l'image : il ouvrirait la même erreur,
              en pleine page cette fois. */}
          <a
            className="lol-btn"
            href="/api/bilan/image"
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-block" }}
          >
            {t.ouvrir}
          </a>
        </>
      )}
    </div>
  );

  if (erreur) {
    return (
      <div className="space-y-4">
        <h1 className="titre-page">{t.titre}</h1>
        <p className="lol-panel p-5" style={{ color: "var(--steel)" }}>{t.erreur}</p>
      </div>
    );
  }

  const effortPaye = bilan
    ? ventiler(bilan.repartitionPayee, null, etiquette).map((p) => p.valeur).join(" + ") || t.aucun
    : t.aucun;

  /**
   * Une seule sortie, et l'image toujours à la même place dans l'arbre.
   *
   * Deux `return` distincts — un pendant le chargement, un après — donnaient
   * deux structures différentes : React démontait la balise et en créait une
   * autre à l'arrivée des données. Le navigateur repartait alors sur un
   * nouveau candidat au plus grand élément, peint à 3850 ms, alors que
   * l'image était téléchargée depuis 2100. Le défaut ne se voyait pas à
   * l'écran : la même image, au même endroit, simplement recréée.
   *
   * La structure est donc identique dans les deux états ; seuls les chiffres
   * attendent.
   */
  return (
    <div className="space-y-6">
      <div>
        <h1 className="titre-page">{t.titre}</h1>
        <p style={{ color: "var(--steel)", fontSize: "0.9rem" }}>{t.sousTitre(JOURS_SAISON)}</p>
      </div>

      {aDesParties && blocImage}

      {!bilan ? (
        <p className="lol-panel p-5" role="status" style={{ color: "var(--steel)" }}>
          {t.chargement}
        </p>
      ) : bilan.parties === 0 ? (
        <div className="lol-panel p-5">
          <div style={{ fontWeight: 600 }}>{t.videTitre}</div>
          <p style={{ color: "var(--steel)", fontSize: "0.9rem", marginTop: 6 }}>{t.videAide}</p>
        </div>
      ) : (
        <div style={{
          display: "grid", gap: 10,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        }}>
          <Case legende={t.parties} valeur={nombre(bilan.parties)} />
          <Case legende={t.winrate}
                valeur={bilan.winrate === null ? t.aucun : pourcent(bilan.winrate)} />
          <Case legende={tEffort.nom} valeur={effortPaye} />
          <Case legende={t.serie} valeur={nombre(bilan.meilleureSerie)} />
          <Case legende={t.joursActifs} valeur={nombre(bilan.joursActifs)} />
          <Case legende={t.pireJour}
                valeur={bilan.pireJour ? date(bilan.pireJour.jour) : t.aucun} />
          <Case legende={t.jeuPrincipal} valeur={bilan.jeuPrincipal?.nom ?? t.aucun} />
          <Case legende={t.championPrincipal} valeur={bilan.championPrincipal?.nom ?? t.aucun} />
        </div>
      )}
    </div>
  );
}
