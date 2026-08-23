"use client";
import { useEffect, useState } from "react";
import { useT, useLocale, etiquetteLocale } from "@/lib/i18n/LocaleContext";
import { bilanSaison as dictBilan } from "@/lib/i18n/dictionaries/bilanSaison";
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

function Case({ legende, valeur }: { legende: string; valeur: string }) {
  return (
    <div className="lol-panel" style={{ padding: "14px 16px" }}>
      <div style={{
        fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.13em",
        color: "var(--steel)",
      }}>
        {legende}
      </div>
      <div className="mono-num" style={{
        fontSize: "1.6rem", fontWeight: 700, color: "var(--amber)", marginTop: 4, lineHeight: 1.1,
      }}>
        {valeur}
      </div>
    </div>
  );
}

export default function BilanPage() {
  const t = useT(dictBilan);
  const locale = useLocale();
  const [bilan, setBilan] = useState<Bilan | null>(null);
  const [erreur, setErreur] = useState(false);

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
  const date = (jour: string) => {
    const [a, m, j] = jour.split("-").map(Number);
    return new Intl.DateTimeFormat(etiquette, { day: "numeric", month: "long" })
      .format(new Date(Date.UTC(a, m - 1, j)));
  };

  if (erreur) {
    return (
      <div className="space-y-4">
        <h1 className="titre-page">{t.titre}</h1>
        <p className="lol-panel p-5" style={{ color: "var(--steel)" }}>{t.erreur}</p>
      </div>
    );
  }

  if (!bilan) {
    return (
      <div className="space-y-4">
        <h1 className="titre-page">{t.titre}</h1>
        <p className="lol-panel p-5" role="status" style={{ color: "var(--steel)" }}>
          {t.chargement}
        </p>
      </div>
    );
  }

  const effortPaye = ventiler(bilan.repartitionPayee).map((p) => p.valeur).join(" + ") || t.aucun;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="titre-page">{t.titre}</h1>
        <p style={{ color: "var(--steel)", fontSize: "0.9rem" }}>{t.sousTitre(JOURS_SAISON)}</p>
      </div>

      {bilan.parties === 0 ? (
        <div className="lol-panel p-5">
          <div style={{ fontWeight: 600 }}>{t.videTitre}</div>
          <p style={{ color: "var(--steel)", fontSize: "0.9rem", marginTop: 6 }}>{t.videAide}</p>
        </div>
      ) : (
        <>
          <div style={{
            display: "grid", gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          }}>
            <Case legende={t.parties} valeur={nombre(bilan.parties)} />
            <Case legende={t.victoires}
                  valeur={bilan.winrate === null ? t.aucun : `${nombre(bilan.winrate)} %`} />
            <Case legende={t.paye} valeur={effortPaye} />
            <Case legende={t.serie} valeur={nombre(bilan.meilleureSerie)} />
            <Case legende={t.joursActifs} valeur={nombre(bilan.joursActifs)} />
            <Case legende={t.pireJour}
                  valeur={bilan.pireJour ? date(bilan.pireJour.jour) : t.aucun} />
            <Case legende={t.jeuPrincipal} valeur={bilan.jeuPrincipal?.nom ?? t.aucun} />
            <Case legende={t.championPrincipal} valeur={bilan.championPrincipal?.nom ?? t.aucun} />
          </div>

          <div className="lol-panel p-5 space-y-3">
            <div style={{
              fontSize: "0.6rem", textTransform: "uppercase", letterSpacing: "0.13em",
              color: "var(--steel)",
            }}>
              {t.imageTitre}
            </div>
            {/* L'image vient d'une route qui exige la session : c'est une
                donnée du compte, même si elle est faite pour être montrée.
                `<img>` plutôt que `next/image` — la source est générée à
                chaque appel et n'a rien à faire dans un cache d'images. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/api/bilan/image"
              alt={t.imageAlt}
              width={1200}
              height={630}
              style={{ width: "100%", height: "auto", borderRadius: 8, display: "block" }}
            />
            <a
              className="lol-btn"
              href="/api/bilan/image"
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: "inline-block" }}
            >
              {t.ouvrir}
            </a>
          </div>
        </>
      )}
    </div>
  );
}
