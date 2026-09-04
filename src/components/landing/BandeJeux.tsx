"use client";
import { useMouvementReduit } from "@/lib/valeurClient";
import { JEUX as CATALOGUE } from "@/lib/jeux";

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

type Decor = {
  court: string;
  /** Nom du fichier attendu dans `public/images/jeux/`, sans extension. */
  code: string;
  /** Couleur d'identité du jeu, reprise du jeu lui-même. */
  teinte: string;
  genre: "moba" | "fps" | "br" | "temps" | "sport" | "tactique";
};

type Jeu = Decor & { nom: string };

/**
 * La parure de chaque jeu, indexée sur le nom du CATALOGUE.
 *
 * Cette table était une seconde liste de jeux, écrite à la main à côté de
 * `src/lib/jeux.ts` — et elle avait déjà divergé : treize entrées contre
 * quinze au catalogue, « Call of Duty » et « Les Sims » manquants. Personne
 * ne l'avait vu, parce qu'une bande de treize pastilles ressemble beaucoup à
 * une bande de quinze. C'est le motif que ce projet paie en boucle : ce n'est
 * pas la copie qu'on remarque, c'est qu'une correction n'en répare qu'une
 * moitié.
 *
 * Elle ne peut PAS se déduire du catalogue — l'abréviation, la teinte et le
 * genre n'y sont pas, et n'y ont rien à faire : le catalogue décide de ce
 * qu'une partie coûte, pas de ce à quoi elle ressemble. Ce qu'on peut faire,
 * c'est cesser d'en refaire la liste : le catalogue donne les jeux et leur
 * ordre, cette table les habille, et `src/bandeJeux.test.ts` refuse qu'un jeu
 * arrive sans parure.
 */
const DECORS: Record<string, Decor> = {
  "League of Legends":      { court: "League", code: "league", teinte: "#C89B3C", genre: "moba" },
  "Valorant":               { court: "Valorant", code: "valorant", teinte: "#FF4655", genre: "fps" },
  "Counter-Strike 2":       { court: "CS2", code: "cs2", teinte: "#F0A83C", genre: "fps" },
  "Fortnite":               { court: "Fortnite", code: "fortnite", teinte: "#8E6BFF", genre: "br" },
  "Apex Legends":           { court: "Apex", code: "apex", teinte: "#DA292A", genre: "br" },
  "PUBG":                   { court: "PUBG", code: "pubg", teinte: "#F4B942", genre: "br" },
  "Call of Duty: Warzone":  { court: "Warzone", code: "warzone", teinte: "#9BAE6B", genre: "br" },
  "Call of Duty":           { court: "Call of Duty", code: "cod", teinte: "#A9B4C2", genre: "fps" },
  "Overwatch":              { court: "Overwatch", code: "overwatch", teinte: "#F99E1A", genre: "fps" },
  "Rocket League":          { court: "Rocket League", code: "rocket-league", teinte: "#3AA7F0", genre: "sport" },
  "Teamfight Tactics":      { court: "TFT", code: "tft", teinte: "#B389FF", genre: "tactique" },
  "Minecraft":              { court: "Minecraft", code: "minecraft", teinte: "#5FA83C", genre: "temps" },
  "World of Warcraft":      { court: "WoW", code: "wow", teinte: "#F4C542", genre: "temps" },
  "Grand Theft Auto V":     { court: "GTA V", code: "gta5", teinte: "#4FBF7F", genre: "temps" },
  "Elden Ring":             { court: "Elden Ring", code: "elden-ring", teinte: "#D6B15C", genre: "temps" },
  "Les Sims":               { court: "Les Sims", code: "sims", teinte: "#6FCF3F", genre: "temps" },
};

/**
 * L'ordre est celui du catalogue, et un jeu sans parure est SAUTÉ.
 *
 * Le sauter plutôt que de le rendre sans couleur est le bon repli : une
 * pastille grise sans glyphe se lit comme un défaut d'affichage sur la page
 * qui existe pour faire venir du monde. Le test, lui, refuse ce cas à
 * l'écriture — donc ce repli ne doit jamais servir, et c'est écrit ici pour
 * qu'on ne le prenne pas pour une tolérance.
 */
const JEUX: Jeu[] = CATALOGUE
  .filter((j) => DECORS[j.nom])
  .map((j) => ({ nom: j.nom, ...DECORS[j.nom] }));

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

function Pastille({ jeu, logo }: { jeu: Jeu; logo?: string }) {
  return (
    <div className="jeu-tuile" style={{ ["--teinte" as string]: jeu.teinte }} title={jeu.nom}>
      <span className="jeu-glyphe">
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- taille fixe, pas de variantes à générer
          <img src={`/images/jeux/${logo}`} alt="" width={22} height={22} className="jeu-logo" />
        ) : (
          <Glyphe genre={jeu.genre} teinte={jeu.teinte} />
        )}
      </span>
      <span className="jeu-nom">{jeu.court}</span>
    </div>
  );
}

export function BandeJeux({ legende, logos }: { legende: string; logos: Record<string, string> }) {
  const mouvementReduit = useMouvementReduit();
  // Deux exemplaires bout à bout : le défilement boucle sans saut visible.
  // Le second est masqué aux lecteurs d'écran, qui liraient sinon deux fois.
  return (
    <div className="bande-jeux" aria-label={legende}>
      <div className={`bande-jeux-piste${mouvementReduit ? " immobile" : ""}`}>
        {JEUX.map((j) => <Pastille key={j.nom} jeu={j} logo={logos[j.code]} />)}
        <span aria-hidden style={{ display: "contents" }}>
          {JEUX.map((j) => <Pastille key={`bis-${j.nom}`} jeu={j} logo={logos[j.code]} />)}
        </span>
      </div>
    </div>
  );
}
