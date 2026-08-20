"use client";
import { useMouvementReduit } from "@/lib/valeurClient";

/**
 * La bande des jeux pris en charge.
 *
 * Ils étaient listés en texte brut, séparés par des points médians : une ligne
 * de plus à lire, que personne ne lit. Un joueur reconnaît un jeu à sa couleur
 * et à sa forme avant d'en lire le nom.
 *
 * Les marques ne sont pas reproduites : chaque jeu reçoit ici une pastille
 * dessinée pour ce site — sa couleur d'identité, et un glyphe qui dit son
 * genre (l'objectif d'un MOBA, le réticule d'un FPS, l'anneau qui se resserre
 * d'un battle royale, le cube d'un bac à sable). C'est un repère honnête, qui
 * n'emprunte l'identité de personne.
 *
 * L'emplacement du vrai logo est prêt : déposer un fichier
 * `public/images/jeux/<code>.svg` — le code est celui de chaque entrée
 * ci-dessous — suffit à le voir remplacer le glyphe. Rien d'autre à changer.
 * La présence du fichier est constatée sur le disque au rendu serveur, pas
 * devinée dans le navigateur : la bande ne se casse jamais parce qu'un logo
 * manque, et le dépôt ne contient aucune marque qui ne nous appartienne pas.
 */

type Jeu = {
  nom: string;
  court: string;
  /** Nom du fichier attendu dans `public/images/jeux/`, sans extension. */
  code: string;
  /** Couleur d'identité du jeu, reprise du jeu lui-même. */
  teinte: string;
  genre: "moba" | "fps" | "br" | "temps" | "sport" | "tactique";
};

const JEUX: Jeu[] = [
  { nom: "League of Legends", court: "League", code: "league", teinte: "#C89B3C", genre: "moba" },
  { nom: "Valorant",          court: "Valorant", code: "valorant", teinte: "#FF4655", genre: "fps" },
  { nom: "Counter-Strike 2",  court: "CS2", code: "cs2", teinte: "#F0A83C", genre: "fps" },
  { nom: "Fortnite",          court: "Fortnite", code: "fortnite", teinte: "#8E6BFF", genre: "br" },
  { nom: "Apex Legends",      court: "Apex", code: "apex", teinte: "#DA292A", genre: "br" },
  { nom: "Call of Duty: Warzone", court: "Warzone", code: "warzone", teinte: "#9BAE6B", genre: "br" },
  { nom: "Rocket League",     court: "Rocket League", code: "rocket-league", teinte: "#3AA7F0", genre: "sport" },
  { nom: "Teamfight Tactics", court: "TFT", code: "tft", teinte: "#B389FF", genre: "tactique" },
  { nom: "Minecraft",         court: "Minecraft", code: "minecraft", teinte: "#5FA83C", genre: "temps" },
  { nom: "World of Warcraft", court: "WoW", code: "wow", teinte: "#F4C542", genre: "temps" },
  { nom: "Grand Theft Auto V", court: "GTA V", code: "gta5", teinte: "#4FBF7F", genre: "temps" },
  { nom: "Elden Ring",        court: "Elden Ring", code: "elden-ring", teinte: "#D6B15C", genre: "temps" },
];

/** Un glyphe par genre : ce que le jeu demande, dessiné. */
function Glyphe({ genre, teinte }: { genre: Jeu["genre"]; teinte: string }) {
  const commun = {
    width: 22, height: 22, viewBox: "0 0 24 24", fill: "none",
    stroke: teinte, strokeWidth: 1.7,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (genre) {
    case "moba":     // les trois voies et le nexus
      return <svg {...commun} aria-hidden><path d="M4 20 20 4" /><path d="M4 12h7" /><path d="M13 20h7" /><circle cx="19" cy="5" r="2" /></svg>;
    case "fps":      // le réticule
      return <svg {...commun} aria-hidden><circle cx="12" cy="12" r="7" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" /></svg>;
    case "br":       // l'anneau qui se resserre
      return <svg {...commun} aria-hidden><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" strokeDasharray="3 2.5" /></svg>;
    case "sport":    // le ballon et la trajectoire
      return <svg {...commun} aria-hidden><circle cx="9" cy="15" r="4" /><path d="M13 12 21 4" /><path d="M16 4h5v5" /></svg>;
    case "tactique": // le damier
      return <svg {...commun} aria-hidden><path d="M4 4h7v7H4zM13 13h7v7h-7z" /><path d="M13 4h7v7h-7zM4 13h7v7H4z" opacity="0.35" /></svg>;
    case "temps":    // le cube, et l'heure qui passe
      return <svg {...commun} aria-hidden><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="M12 12v9M12 12 4 7.5M12 12l8-4.5" /></svg>;
  }
}

function Pastille({ jeu, avecLogo }: { jeu: Jeu; avecLogo: boolean }) {
  return (
    <div className="jeu-tuile" style={{ ["--teinte" as string]: jeu.teinte }} title={jeu.nom}>
      <span className="jeu-glyphe">
        {avecLogo ? (
          // eslint-disable-next-line @next/next/no-img-element -- taille fixe, pas de variantes à générer
          <img src={`/images/jeux/${jeu.code}.svg`} alt="" width={22} height={22} className="jeu-logo" />
        ) : (
          <Glyphe genre={jeu.genre} teinte={jeu.teinte} />
        )}
      </span>
      <span className="jeu-nom">{jeu.court}</span>
    </div>
  );
}

export function BandeJeux({ legende, logos }: { legende: string; logos: string[] }) {
  const mouvementReduit = useMouvementReduit();
  const disponibles = new Set(logos);
  // Deux exemplaires bout à bout : le défilement boucle sans saut visible.
  // Le second est masqué aux lecteurs d'écran, qui liraient sinon deux fois.
  return (
    <div className="bande-jeux" aria-label={legende}>
      <div className={`bande-jeux-piste${mouvementReduit ? " immobile" : ""}`}>
        {JEUX.map((j) => <Pastille key={j.nom} jeu={j} avecLogo={disponibles.has(j.code)} />)}
        <span aria-hidden style={{ display: "contents" }}>
          {JEUX.map((j) => <Pastille key={`bis-${j.nom}`} jeu={j} avecLogo={disponibles.has(j.code)} />)}
        </span>
      </div>
    </div>
  );
}
