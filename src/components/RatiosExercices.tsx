"use client";
import { useEffect, useState } from "react";
import { appliquerRatios, type RatiosExercices } from "@/lib/exercices";

/** Deux jeux de ratios décrivent-ils la même chose ? */
function memes(a: RatiosExercices, b: RatiosExercices): boolean {
  return (Object.keys(a) as (keyof RatiosExercices)[]).every((k) => a[k] === b[k]);
}

/**
 * Installe les ratios d'exercices dans le navigateur.
 *
 * Les conversions points → répétitions sont synchrones et lues depuis le
 * module, côté serveur comme côté client. Le serveur les a déjà appliqués
 * avant de rendre la page ; ce composant fait la même chose dans le
 * navigateur, sans quoi l'hydratation recalculerait les mêmes affichages avec
 * les ratios d'origine et remplacerait silencieusement les valeurs justes.
 *
 * L'application se fait à l'initialisation de l'état, donc pendant le premier
 * rendu de ce composant et avant celui de ses enfants — les seuls à convertir
 * quoi que ce soit. Passer par un effet arriverait trop tard : les enfants
 * auraient déjà affiché de mauvais nombres.
 *
 * Puis la valeur est relue à la source. Les pages sans données propres au
 * compte sont mises en cache : celle qui arrive dans le HTML peut être celle
 * du déploiement, et un changement fait en administration ne l'a pas
 * forcément rejointe. C'est vérifié en conditions réelles, contrairement à
 * l'invalidation de cache, qui ne débloque pas une page déjà prérendue.
 *
 * Quand l'écart existe — cas rare, juste après un réglage — on remonte
 * l'arbre par sa clé. Rien d'autre ne rafraîchirait les écrans : les enfants
 * arrivent du serveur sous forme d'éléments stables, et un simple nouveau
 * rendu de ce composant les laisserait intacts.
 */
export function RatiosExercicesProvider({
  valeurs,
  children,
}: {
  valeurs: RatiosExercices;
  children: React.ReactNode;
}) {
  const [actifs, setActifs] = useState(() => appliquerRatios(valeurs));

  useEffect(() => {
    let vivant = true;
    fetch("/api/exercices/ratios")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivant || !d?.ratios) return;
        const frais = appliquerRatios(d.ratios);
        setActifs((precedent) => (memes(precedent, frais) ? precedent : frais));
      })
      .catch(() => {
        // Réseau coupé : les ratios du HTML restent en place, ce qui est le
        // bon repli — ils viennent du serveur, pas d'une valeur inventée.
      });
    return () => { vivant = false; };
  }, []);

  return <div key={`${actifs.squats}-${actifs.boxe}`} style={{ display: "contents" }}>{children}</div>;
}
