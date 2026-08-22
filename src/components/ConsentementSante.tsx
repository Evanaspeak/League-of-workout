"use client";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Modale } from "@/components/Modale";
import { useT } from "@/lib/i18n/LocaleContext";
import { consentementSante as dict } from "@/lib/i18n/dictionaries/consentementSante";
import { estPagePublique } from "@/lib/pagesPubliques";

type Etat = "jamais" | "accepte" | "refuse";

/**
 * Demande le consentement au traitement des données de santé.
 *
 * Elle ne se ferme pas. Ce n'est pas une insistance commerciale : tant que la
 * question n'a pas de réponse, l'application détient un poids et une taille
 * qu'elle n'a pas le droit de traiter. Un « plus tard » reviendrait à continuer
 * de faire exactement ce dont on demande la permission.
 *
 * Les deux issues sont au même niveau. Un refus qui coûterait plus cher qu'une
 * acceptation ne serait pas un consentement libre — et il efface vraiment.
 */
export function ConsentementSante() {
  const t = useT(dict);
  const chemin = usePathname();
  const [etat, setEtat] = useState<Etat | null>(null);
  const [aDesDonnees, setADesDonnees] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const publique = estPagePublique(chemin);

  useEffect(() => {
    // Rien à demander sur les pages publiques : personne n'y est connecté, et
    // la question s'y poserait par-dessus l'accueil.
    if (publique) { setEtat(null); return; }
    let vivant = true;
    fetch("/api/consentement")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivant || !d) return;
        setEtat(d.etat as Etat);
        setADesDonnees(Boolean(d.aDesDonnees));
      })
      .catch(() => {});
    return () => { vivant = false; };
  }, [publique, chemin]);

  if (etat !== "jamais") return null;

  const repondre = async (accepte: boolean) => {
    setEnvoi(true);
    try {
      const r = await fetch("/api/consentement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepte }),
      });
      // Une réponse perdue ne doit pas faire disparaître la question : sans
      // trace en base, on la reposera à la prochaine ouverture.
      if (r.ok) setEtat(accepte ? "accepte" : "refuse");
    } catch {
      /* la question reste posée */
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Modale titre={t.titre} onFermer={() => {}} sansFermeture largeur="32rem">
      <div className="flex flex-col gap-4" style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
        <p style={{ color: "var(--muted)" }}>
          {aDesDonnees ? t.introAvecDonnees : t.introSansDonnees}
        </p>

        <div className="flex flex-col gap-3">
          <Bloc titre={t.aQuoiTitre} lignes={t.aQuoi} />
          <Bloc titre={t.jamaisTitre} lignes={t.jamais} />
        </div>

        <p style={{ color: "var(--muted)" }}>{t.siRefus}</p>

        <div className="flex flex-wrap gap-3" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="lol-btn"
            disabled={envoi}
            onClick={() => repondre(true)}
            style={{ flex: "1 1 12rem" }}
          >
            {envoi ? t.enCours : t.accepter}
          </button>
          <button
            type="button"
            className="lol-btn"
            disabled={envoi}
            onClick={() => repondre(false)}
            style={{ flex: "1 1 12rem", background: "transparent" }}
          >
            {t.refuser}
          </button>
        </div>

        <Link
          href="/confidentialite"
          style={{ color: "var(--muted)", fontSize: "0.8rem", textDecoration: "underline" }}
        >
          {t.lien}
        </Link>
      </div>
    </Modale>
  );
}

/** Une liste courte sous un intertitre. */
function Bloc({ titre, lignes }: { titre: string; lignes: string[] }) {
  return (
    <div>
      <div
        style={{
          fontSize: "0.72rem", letterSpacing: "0.08em", textTransform: "uppercase",
          color: "var(--gold)", marginBottom: 4,
        }}
      >
        {titre}
      </div>
      <ul style={{ margin: 0, paddingLeft: "1.1rem", color: "var(--muted)" }}>
        {lignes.map((l) => <li key={l}>{l}</li>)}
      </ul>
    </div>
  );
}
