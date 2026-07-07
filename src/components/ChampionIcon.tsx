"use client";
import { useEffect, useState } from "react";

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

// Cache module-level : une seule requête par session navigateur.
let _version: string | null = null;
async function getVersion(): Promise<string> {
  if (_version) return _version;
  try {
    const r = await fetch("https://ddragon.leagueoflegends.com/api/versions.json");
    const v: string[] = await r.json();
    _version = v[0];
    return _version;
  } catch {
    return "14.24.1";
  }
}

interface Props {
  name: string | null | undefined;
  size?: number;
}

export function ChampionIcon({ name, size = 38 }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!name) return;
    setFailed(false);
    getVersion().then((v) => {
      setSrc(`https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${toKey(name)}.png`);
    });
  }, [name]);

  const r = Math.round(size * 0.13);

  if (!name || failed || !src) {
    return (
      <div style={{
        width: size, height: size, borderRadius: r, flexShrink: 0,
        background: "rgba(152,162,176,0.1)",
        border: "1px solid rgba(152,162,176,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.42, fontWeight: 600, color: "rgba(152,162,176,0.5)",
        fontFamily: "var(--font-heading, 'Barlow Condensed', sans-serif)",
      }}>
        {name ? name.charAt(0).toUpperCase() : "?"}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
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
