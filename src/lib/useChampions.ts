"use client";
import { useEffect, useState } from "react";
import { CHAMPIONS } from "@/lib/champions";

// La liste des champions peut être surchargée en base par l'admin
// (table SystemConfig, clé "champions"). Elle est partagée ici pour qu'un
// formulaire ne valide jamais contre la liste codée en dur pendant qu'un
// autre valide contre la liste à jour : un champion ajouté par l'admin
// doit être accepté partout d'un coup.
let cache: string[] | null = null;
let enCours: Promise<string[]> | null = null;

function charger(): Promise<string[]> {
  if (cache) return Promise.resolve(cache);
  if (!enCours) {
    enCours = fetch("/api/champions", { cache: "no-store" })
      .then((r) => r.json())
      .then((list: unknown) => {
        if (Array.isArray(list) && list.length > 0) cache = list as string[];
        return cache ?? CHAMPIONS;
      })
      .catch(() => CHAMPIONS);
  }
  return enCours;
}

export function useChampions(): string[] {
  const [liste, setListe] = useState<string[]>(cache ?? CHAMPIONS);
  useEffect(() => {
    let vivant = true;
    charger().then((l) => {
      if (vivant) setListe(l);
    });
    return () => {
      vivant = false;
    };
  }, []);
  return liste;
}

/**
 * À appeler après une modification de la liste côté admin : sans ça, les
 * onglets déjà ouverts gardent l'ancienne liste jusqu'au prochain rechargement.
 */
export function invaliderChampions() {
  cache = null;
  enCours = null;
}

/** Vrai si le nom figure dans la liste fournie, sans tenir compte de la casse. */
export function championConnu(liste: string[], nom: string): boolean {
  const normalise = nom.trim().toLowerCase();
  return liste.some((c) => c.toLowerCase() === normalise);
}
