"use client";
import { fetchBorne } from "./reseau";
import { useEffect, useState } from "react";
import { ALIAS_CHAMPIONS, CHAMPIONS } from "@/lib/champions";

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
    enCours = fetchBorne("/api/champions", { cache: "no-store" })
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

/**
 * Vrai si le nom est EXACTEMENT celui d'un champion, à la casse près.
 *
 * C'est ce que la base doit recevoir : `Game.champion` stocke cette chaîne,
 * l'icône de Data Dragon s'en déduit, et le compte de maîtrise regroupe
 * dessus. « Chogath » enregistré à la place de « Cho'Gath » donnerait une
 * icône cassée et deux champions là où il n'y en a qu'un.
 *
 * Ce qu'on tape, en revanche, n'a aucune raison d'être exact : c'est
 * `resoudreChampion` qui fait le pont, et le formulaire résout AVANT de
 * vérifier.
 */
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
 * Le champion que cette saisie désigne, sous sa forme canonique — ou `null`.
 *
 * **Le champ proposait ce que le bouton refusait**, et c'était le vrai défaut :
 * la liste déroulante aplatit les accents et la ponctuation, la validation
 * comparait la chaîne exacte. On tapait « Chogath », on voyait « Cho'Gath »
 * proposé, on ne cliquait pas, et le bouton d'enregistrement restait éteint
 * sans rien dire. Deux règles pour une seule question, ce que ce projet paie
 * en boucle.
 *
 * La résolution ne rend un nom que si l'aplatissement en désigne **un seul** :
 * deviner entre deux champions serait enregistrer une partie qui n'est pas
 * celle qu'on a jouée. Aucune collision aujourd'hui — un test l'éprouve sur
 * la liste entière, parce que c'est le jour où Riot en ajoute un que ça
 * changerait.
 */
export function resoudreChampion(liste: string[], saisie: string): string | null {
  const brut = saisie.trim();
  if (!brut) return null;
  const exact = liste.find((c) => c.toLowerCase() === brut.toLowerCase());
  if (exact) return exact;

  const q = aplatir(brut);
  if (!q) return null;

  const candidats = liste.filter((c) => aplatir(c) === q);
  if (candidats.length === 1) return candidats[0];
  if (candidats.length > 1) return null;

  // Les noms traduits, qui ne se ramènent pas d'eux-mêmes.
  for (const [localise, canonique] of Object.entries(ALIAS_CHAMPIONS)) {
    if (aplatir(localise) === q) return liste.includes(canonique) ? canonique : null;
  }
  return null;
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

  /**
   * On cherche aussi sur les noms TRADUITS, et on propose le canonique.
   *
   * Sans ça, « Maî » ne rend rien : le champ resterait muet devant quelqu'un
   * qui tape le nom qu'il lit dans son client. Ce qui s'affiche reste le nom
   * anglais, parce que c'est lui qu'on enregistre — proposer « Maître Yi »
   * puis stocker « Master Yi » ferait deux vérités.
   */
  const candidats: { nom: string; r: number }[] = liste.map((nom) => ({ nom, r: rang(nom) }));
  for (const [localise, canonique] of Object.entries(ALIAS_CHAMPIONS)) {
    if (!liste.includes(canonique)) continue;
    const r = rang(localise);
    const deja = candidats.find((c) => c.nom === canonique);
    if (deja) deja.r = Math.min(deja.r, r);
    else if (r < 3) candidats.push({ nom: canonique, r });
  }

  return candidats
    .filter((x) => x.r < 3)
    .sort((a, b) => a.r - b.r || a.nom.localeCompare(b.nom, "en"))
    .slice(0, limite)
    .map((x) => x.nom);
}
