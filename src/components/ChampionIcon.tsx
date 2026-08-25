"use client";
import { useEffect, useRef, useState } from "react";

// Certains champions ont un ID Data Dragon différent de leur nom affiché.
const CHAMPION_MAP: Record<string, string> = {
  "Bel'Veth":        "Belveth",
  "Cho'Gath":        "Chogath",
  "Dr. Mundo":       "DrMundo",
  "Jarvan IV":       "JarvanIV",
  "Kai'Sa":          "Kaisa",
  "Kha'Zix":         "Khazix",
  "Kog'Maw":         "KogMaw",
  "LeBlanc":         "Leblanc",
  "Lee Sin":         "LeeSin",
  "Master Yi":       "MasterYi",
  "Miss Fortune":    "MissFortune",
  "Nunu & Willump":  "Nunu",
  "Rek'Sai":         "RekSai",
  "Renata Glasc":    "Renata",
  "Tahm Kench":      "TahmKench",
  "Twisted Fate":    "TwistedFate",
  "Vel'Koz":         "Velkoz",
  "Wukong":          "MonkeyKing",
  "Xin Zhao":        "XinZhao",
  "Aurelion Sol":    "AurelionSol",
  "Aatrox":          "Aatrox",
};

function toKey(name: string): string {
  return CHAMPION_MAP[name] ?? name.replace(/['\s.&]/g, "");
}

/**
 * Version de Data Dragon, figée au build.
 *
 * Le composant demandait la liste des versions à Riot au montage, une fois par
 * session de navigateur. C'était une requête réseau bloquante avant la
 * première icône, chez un tiers, sur un chemin critique de la page — et si
 * Riot répondait lentement, aucune icône ne s'affichait pendant ce temps.
 * Les icônes de champions ne changent pas d'un patch à l'autre : la version
 * n'a pas besoin d'être fraîche, elle a besoin d'exister.
 *
 * `NEXT_PUBLIC_DDRAGON_VERSION` permet de la relever sans toucher au code —
 * elle est compilée au build, donc un redéploiement suffit.
 */
const DDRAGON_VERSION = process.env.NEXT_PUBLIC_DDRAGON_VERSION || "16.16.1";

interface Props {
  name: string | null | undefined;
  size?: number;
}

export function ChampionIcon({ name, size = 38 }: Props) {
  // On retient le champion dont l'image a échoué, plutôt qu'un simple drapeau
  // à remettre à zéro : changer de champion suffit alors à repartir de zéro,
  // sans écrire dans un effet.
  const [echouePour, setEchouePour] = useState<string | null>(null);
  const failed = echouePour === name;

  /**
   * `onError` ne suffit pas.
   *
   * L'image est servie par un domaine tiers et part avec le HTML : elle peut
   * échouer AVANT l'hydratation, et React n'attache son écouteur qu'après. Le
   * repli — la première lettre du champion dans un carré — ne s'affichait alors
   * jamais, et la place restait vide. Trouvé sur l'image du bilan, où le même
   * défaut se voyait mieux.
   *
   * Une image déjà terminée le dit : `complete` vaut vrai et `naturalWidth`
   * vaut zéro.
   */
  const imageRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = imageRef.current;
    if (img && img.complete && img.naturalWidth === 0 && name) setEchouePour(name);
  });

  // La source ne dépend plus que du nom : elle se calcule au rendu, sans
  // effet ni second rendu pour rien.
  const src = name
    ? `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${toKey(name)}.png`
    : null;

  const r = Math.round(size * 0.13);

  if (!name || failed || !src) {
    return (
      <div style={{
        width: size, height: size, borderRadius: r, flexShrink: 0,
        background: "rgba(152,162,176,0.1)",
        border: "1px solid rgba(152,162,176,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.42, fontWeight: 600, color: "var(--faint)",
        fontFamily: "var(--font-heading, 'Chakra Petch', sans-serif)",
      }}>
        {name ? name.charAt(0).toUpperCase() : "?"}
      </div>
    );
  }

  return (
    <img
      ref={imageRef}
      src={src}
      alt={name}
      width={size}
      height={size}
      onError={() => setEchouePour(name)}
      style={{
        borderRadius: r,
        border: "1px solid rgba(152,162,176,0.25)",
        objectFit: "cover",
        flexShrink: 0,
        display: "block",
      }}
    />
  );
}
