"use client";
import { useEffect, useState } from "react";
import { jourLocal } from "@/lib/serie";
import { chargerProgression, rafraichirProgression, type Progression } from "@/lib/chargerProgression";
import { useDateLocale, useT } from "@/lib/i18n/LocaleContext";
import { badges as dict } from "@/lib/i18n/dictionaries/badges";
import { titres as dictTitres } from "@/lib/i18n/dictionaries/titres";
import type { Badge } from "@/lib/badges";
import type { Avancement, CleTitre } from "@/lib/niveauCompte";

type Reponse = {
  badges: Badge[];
  prochain: Badge | null;
  /**
   * Le niveau et le titre arrivent dans la MÊME réponse que les paliers.
   *
   * Ils se déduisent des mêmes chiffres ; leur donner une route à eux ferait
   * un aller-retour de plus vers Neon pour relire les mêmes lignes, et ce
   * défaut a déjà été corrigé une fois ici en fusionnant `/api/badges` et
   * `/api/serie`. Ils sont optionnels parce qu'une page servie par un
   * déploiement antérieur peut recevoir une réponse qui ne les porte pas.
   */
  niveau?: Avancement;
  titre?: CleTitre | null;
};

/**
 * Les exploits arrivent à côté des paliers, pas dedans.
 *
 * Un palier porte un seuil et un avancement ; un exploit n'a ni l'un ni
 * l'autre — il a eu lieu ou non. Les forcer dans la même forme aurait demandé
 * d'inventer un seuil de un, et le composant aurait dessiné une barre de
 * progression vers un événement.
 */
type Exploits = { dansLHeure: boolean };

/**
 * Les paliers, sur le tableau de bord.
 *
 * Le libellé se compose à partir de la clé : « volume500 » devient « 500 points
 * d'effort ». Écrire les dix-huit noms à la main dans six langues aurait fait
 * cent huit chaînes, dont la moitié auraient fini par diverger d'un seuil
 * changé dans le code.
 */
export function Paliers() {
  const t = useT(dict);
  const tt = useT(dictTitres);
  const nombre = new Intl.NumberFormat(useDateLocale());
  const [etat, setEtat] = useState<Reponse | null>(null);
  const [exploits, setExploits] = useState<Exploits | null>(null);

  /**
   * Les paliers viennent de l'appel commun, partagé avec la série.
   *
   * Les deux composants demandaient leur route de leur côté, et les deux
   * routes lisaient la même requête de paiements : deux allers-retours pour
   * deux réponses qui se déduisent des mêmes lignes.
   */
  useEffect(() => {
    const poser = (p: Progression | null) => {
      if (p?.badges) setEtat(p.badges as Reponse);
      if (p?.exploits) setExploits(p.exploits as Exploits);
    };
    void chargerProgression(jourLocal()).then(poser);
    const relire = () => { void rafraichirProgression(jourLocal()).then(poser); };
    window.addEventListener("wow-dette-changee", relire);
    return () => window.removeEventListener("wow-dette-changee", relire);
  }, []);

  if (!etat) return null;

  const nommer = (badge: Badge): string => {
    const famille = badge.cle.replace(/\d+$/, "");
    if (famille === "volume") return t.volume(badge.seuil);
    if (famille === "parties") return t.parties(badge.seuil);
    return t.serie(badge.seuil);
  };

  const obtenus = etat.badges.filter((b) => b.obtenu);

  return (
    <div className="lol-panel p-5 space-y-4">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <div>
          <h2 className="titre-section">{t.titre}</h2>
          <p className="text-xs mt-1" style={{ color: "var(--steel)" }}>{t.aide}</p>
        </div>
        <span className="text-xs" style={{ color: "var(--steel)", fontVariantNumeric: "tabular-nums" }}>
          {t.obtenus(obtenus.length, etat.badges.length)}
        </span>
      </div>

      {etat.niveau && (
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span className="mono-num" style={{ fontSize: "1.5rem", color: "var(--gold)" }}>
            {`${tt.niveau} ${etat.niveau.niveau}`}
          </span>
          {/*
            L'XP totale, en toutes lettres. C'est la moitié « jeu vidéo » de la
            demande : un niveau sans compteur derrière ne dit pas ce qui le
            fait monter. Le nombre passe par `Intl` — un séparateur de milliers
            écrit à la main serait faux dans quatre langues sur six.
          */}
          <span className="mono-num" style={{ fontSize: "0.95rem", color: "var(--gold)", opacity: .8 }}>
            {`${nombre.format(etat.niveau.xp)} ${tt.xp}`}
          </span>
          {etat.titre && (
            <span
              style={{
                fontSize: "0.72rem", padding: "3px 8px", borderRadius: 999,
                border: "1px solid var(--blue, #0bc4e3)", color: "var(--blue, #0bc4e3)",
              }}
            >
              {tt[etat.titre]}
            </span>
          )}
          <span className="mono-num" style={{ fontSize: "0.8rem", color: "var(--steel)" }}>
            {`${etat.niveau.restant} ${tt.xp} ${tt.versLeNiveau} ${etat.niveau.niveau + 1}`}
          </span>
        </div>
      )}

      {etat.prochain ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div className="flex items-baseline justify-between gap-3">
            <span style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
              {t.prochain} · {nommer(etat.prochain)}
            </span>
            <b style={{ fontSize: "0.8rem", fontVariantNumeric: "tabular-nums" }}>
              {etat.prochain.avancement} / {etat.prochain.seuil}
            </b>
          </div>
          <div style={{ height: 6, background: "rgba(152,162,176,0.15)", borderRadius: 3 }}>
            <div
              style={{
                height: "100%", borderRadius: 3, background: "var(--gold)",
                width: `${Math.round((etat.prochain.avancement / etat.prochain.seuil) * 100)}%`,
              }}
            />
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>{t.tout}</p>
      )}

      {obtenus.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {exploits?.dansLHeure && (
            <span
              title={tt.eclairAide}
              style={{
                fontSize: "0.72rem", padding: "3px 8px", borderRadius: 999,
                border: "1px solid var(--blue, #0bc4e3)", color: "var(--blue, #0bc4e3)",
              }}
            >
              {tt.eclair}
            </span>
          )}
          {obtenus.map((b) => (
            <span
              key={b.cle}
              style={{
                fontSize: "0.72rem", padding: "3px 8px", borderRadius: 999,
                border: "1px solid var(--gold)", color: "var(--gold)",
              }}
            >
              {nommer(b)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
