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

/**
 * La liste en vigueur : celle de la base si l'admin l'a modifiée, sinon celle
 * du code. Exportée pour être éprouvée — le crochet, lui, a besoin de React.
 */
export function chargerChampions(): Promise<string[]> {
  if (cache) return Promise.resolve(cache);
  if (!enCours) {
    enCours = fetch("/api/champions", { cache: "no-store" })
      .then((r) => r.json())
      .then((list: unknown) => {
        if (Array.isArray(list) && list.length > 0) cache = list as string[];
        return cache ?? CHAMPIONS;
      })
      .catch(() => {
        /**
         * L'échec ne se mémorise pas.
         *
         * `enCours` retenait la promesse quoi qu'il arrive : une coupure au
         * premier montage figeait la liste codée en dur pour toute la durée de
         * la page, sans jamais réessayer. Et ce n'est pas anodin ici — la même
         * liste sert à VALIDER : un champion ajouté par l'admin devenait
         * « non reconnu », le bouton d'enregistrement restait éteint, et le
         * message accusait la frappe de la personne alors que la faute est
         * chez nous. C'est le défaut de la clé Riot refusée, en plus petit.
         *
         * Effacer la promesse suffit : le prochain montage du champ retente.
         * Il n'y a pas de tempête à craindre, `charger` n'étant appelé qu'au
         * montage d'un composant.
         */
        enCours = null;
        return CHAMPIONS;
      });
  }
  return enCours;
}

export function useChampions(): string[] {
  const [liste, setListe] = useState<string[]>(cache ?? CHAMPIONS);
  useEffect(() => {
    let vivant = true;
    chargerChampions().then((l) => {
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

/** Ramène « Cho'Gath » à « chogath » : on tape rarement les apostrophes. */
function aplatir(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’.\s&-]/g, "");
}

/** Les morceaux d'un nom composé : « Aurelion Sol » → aurelion, sol. */
function mots(nom: string): string[] {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/['’.\s&-]+/)
    .filter(Boolean);
}

/**
 * Propositions classées par pertinence. Taper « r » doit d'abord donner Rakan
 * et Renekton, pas Aatrox : un champion qui contient la lettre quelque part au
 * milieu n'est presque jamais celui qu'on cherche. L'ordre est donc :
 * début du nom, puis début d'un mot du nom, puis simple présence — et
 * alphabétique à pertinence égale.
 */
export function suggererChampions(liste: string[], requete: string, limite = 8): string[] {
  const q = aplatir(requete);
  if (!q) return [];

  const rang = (nom: string): number => {
    if (aplatir(nom).startsWith(q)) return 0;
    if (mots(nom).some((m) => m.startsWith(q))) return 1;
    if (aplatir(nom).includes(q)) return 2;
    return 3;
  };

  return liste
    .map((nom) => ({ nom, r: rang(nom) }))
    .filter((x) => x.r < 3)
    .sort((a, b) => a.r - b.r || a.nom.localeCompare(b.nom, "en"))
    .slice(0, limite)
    .map((x) => x.nom);
}
