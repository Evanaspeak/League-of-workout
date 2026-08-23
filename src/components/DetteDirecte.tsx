"use client";
import { useCallback, useEffect, useRef } from "react";
import {
  formaterCompact, repartirPoints, toExerciceIds, ventiler, type ExerciceId,
} from "@/lib/exercices";
import { ROLE_DEFAUT } from "@/components/PartieDetectee";
import type { ContextePartie, ScoreDirect } from "@/types/electron";

/**
 * Ce que la partie en cours est en train de coûter, poussé vers l'overlay.
 *
 * L'overlay affichait jusqu'ici la dette de session — celle qu'accumule le
 * suivi Riot. Sans clé développeur ce suivi ne rapporte rien, la dette restait
 * à zéro, et le compteur annonçait donc zéro pendant toute la partie alors
 * qu'une dizaine de pompes s'accumulaient.
 *
 * Le calcul se fait ici et non dans l'application desktop : le barème dépend du
 * niveau du compte, des pondérations de rôle et de la maîtrise du champion, que
 * seul le serveur connaît. On passe donc par l'aperçu de scoring, celui-là même
 * qui sert avant d'enregistrer une partie — l'estimation affichée en jeu ne peut
 * pas diverger du chiffre écrit à la fin.
 */

/** Délai avant recalcul, pour ne pas relancer l'aperçu à chaque mort. */
const DELAI_CALCUL_MS = 1500;

/**
 * Jeux qui exposent une partie en cours à qui sait la lire.
 *
 * La même liste vit côté application desktop, qui s'en sert pour masquer les
 * lignes qu'elle ne pourra pas remplir. Ici elle décide de ce qu'on publie :
 * pour un jeu qui ne se raconte pas, il n'y a pas de projection à faire, mais
 * il reste l'effort déjà dû — et c'est justement le chiffre qu'on veut avoir
 * sous les yeux en jouant.
 */
const JEUX_AVEC_RELEVE = new Set(["League of Legends", "Teamfight Tactics"]);

type Projection = {
  /** Ce qu'il y aura à faire si la partie est gagnée. */
  victoire: string;
  /** Et si elle est perdue — l'écart est le malus de défaite. */
  defaite: string;
  /** Effort déjà dû, hors partie en cours. Vide s'il n'y en a pas. */
  enAttente: string;
} | null;

export function DetteDirecte() {
  const exercicesRef = useRef<ExerciceId[]>(["pompes"]);
  const enAttenteRef = useRef("");
  const contexteRef = useRef<ContextePartie | null>(null);
  /** KDA du dernier calcul : inutile de refaire l'aperçu s'il n'a pas bougé. */
  const derniereCleRef = useRef("");
  const minuteurRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** « 11 », ou « 8 · 30 s » quand plusieurs exercices se partagent l'effort. */
  const libelle = useCallback((points: number) => {
    const liste = exercicesRef.current;
    if (liste.length === 1) return formaterCompact(points, liste[0]);
    return ventiler(repartirPoints(points, liste)).map((v) => v.valeur).join(" · ");
  }, []);

  const publier = useCallback((projection: Projection) => {
    window.electronLOL?.publierDette?.(projection);
  }, []);

  /**
   * Relit l'effort déjà dû ET les exercices choisis.
   *
   * Les deux étaient séparés, et les exercices n'étaient lus qu'une fois, au
   * montage. L'application desktop garde sa page ouverte toute la soirée :
   * quelqu'un qui passait de « pompes et boxe » à « pompes » dans les réglages
   * continuait donc à lire deux exercices sur la pastille jusqu'au prochain
   * redémarrage. Le réglage n'a de sens que s'il prend effet en jouant, c'est
   * justement là qu'on le change.
   */
  const chargerAttente = useCallback(async () => {
    try {
      const u = await fetch("/api/user").then((r) => (r.ok ? r.json() : null));
      if (u?.exercices) exercicesRef.current = toExerciceIds(u.exercices);
    } catch { /* on garde la sélection connue */ }
    try {
      const res = await fetch("/api/dette");
      if (!res.ok) return;
      const dette = await res.json();
      const points = Number(dette?.points) || 0;
      enAttenteRef.current = points > 0
        ? ventiler(dette.repartition ?? {}).map((v) => v.valeur).join(" · ")
        : "";
    } catch { /* la prochaine partie relira */ }
  }, []);

  useEffect(() => {
    if (!window.electronLOL?.publierDette) return;
    // Publier dès l'ouverture, et pas seulement au premier événement : la
    // pastille de la barre des tâches doit être juste à l'instant où
    // l'application s'ouvre, pas au bout d'une partie.
    void chargerAttente().then(() => {
      if (enAttenteRef.current) {
        publier({ victoire: "", defaite: "", enAttente: enAttenteRef.current });
      }
    });
  }, [chargerAttente, publier]);

  useEffect(() => {
    const surChangement = () => { chargerAttente(); };
    window.addEventListener("wow-dette-changee", surChangement);
    return () => window.removeEventListener("wow-dette-changee", surChangement);
  }, [chargerAttente]);

  // Le lanceur donne le rôle attribué : c'est la seule source exacte, et le
  // barème en dépend directement.
  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.onPhase) return;
    return pont.onPhase((p) => {
      contexteRef.current = { file: p.file, role: p.role };
      // La partie qui se prépare est le moment de relire les réglages : c'est
      // juste avant de lancer qu'on vient de les changer.
      void chargerAttente();
    });
  }, [chargerAttente]);

  const calculer = useCallback(async (score: ScoreDirect) => {
    const role =
      contexteRef.current?.role
      || (typeof localStorage !== "undefined" && localStorage.getItem("lastRole"))
      || ROLE_DEFAUT;

    try {
      // Un seul aller-retour : l'aperçu en défaite rapporte le score de base, le
      // malus et la surcharge de maîtrise, dont la victoire se déduit avec la
      // même formule que le moteur — une victoire coûte la moitié du score de
      // base, sans malus.
      const res = await fetch("/api/games/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jeu: "League of Legends",
          typeJeu: "parties",
          role,
          champion: score.champion ?? undefined,
          kills: score.kills,
          deaths: score.deaths,
          assists: score.assists,
          result: "D",
          // La classée coûte un quart de plus : sans ce drapeau, la pastille
          // annoncerait le prix d'une normale pendant une partie classée, et
          // l'écart se découvrirait à la fin.
          fileClassee: contexteRef.current?.file?.classee ?? undefined,
        }),
      });
      if (!res.ok) return;
      const { scoring, exercices } = await res.json();
      // La sélection vient du serveur, avec le calcul qu'elle habille : c'est
      // la seule façon d'être sûr que l'unité affichée est celle du compte au
      // moment du calcul, et non celle d'il y a trois heures.
      if (Array.isArray(exercices) && exercices.length > 0) {
        exercicesRef.current = toExerciceIds(exercices);
      }
      const base = Number(scoring?.scoreBase) || 0;
      const surcharge = Number(scoring?.surcharge) || 0;
      const defaite = Number(scoring?.pompesFinales) || 0;
      const victoire = Math.round((base / 2) * (1 + surcharge));

      publier({
        victoire: libelle(victoire),
        defaite: libelle(defaite),
        enAttente: enAttenteRef.current,
      });
    } catch { /* le relevé suivant réessaiera */ }
  }, [libelle, publier]);

  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.onReleve || !pont.publierDette) return;

    const desabonner = pont.onReleve(({ score }) => {
      if (!score) return;
      // Le relevé arrive toutes les cinq secondes, le KDA change bien moins
      // souvent : on ne recalcule que sur un vrai changement.
      const cle = `${score.kills}/${score.deaths}/${score.assists}/${score.champion ?? ""}`;
      if (cle === derniereCleRef.current) return;
      derniereCleRef.current = cle;

      if (minuteurRef.current) clearTimeout(minuteurRef.current);
      minuteurRef.current = setTimeout(() => calculer(score), DELAI_CALCUL_MS);
    });

    return () => {
      desabonner();
      if (minuteurRef.current) clearTimeout(minuteurRef.current);
    };
  }, [calculer]);

  /**
   * Un jeu qui ne se raconte pas : on publie quand même ce qui est dû.
   *
   * Sans relevé, `onReleve` ne se déclenche jamais et l'overlay n'affichait
   * donc rien du tout — ni projection, ce qui est normal, ni effort en attente,
   * ce qui ne l'est pas. Le chiffre existe pourtant, et c'est celui qu'on
   * regarde entre deux parties.
   */
  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.onJeuDetecte || !pont.publierDette) return;

    return pont.onJeuDetecte(async ({ type, jeu }) => {
      if (JEUX_AVEC_RELEVE.has(jeu)) return;
      if (type === "jeu-arrete") { publier(null); return; }
      await chargerAttente();
      publier({ victoire: "", defaite: "", enAttente: enAttenteRef.current });
    });
  }, [chargerAttente, publier]);

  // La dette bouge pendant qu'on joue — une partie enregistrée, un effort
  // rendu. L'overlay doit suivre, sinon il affiche le chiffre de l'ouverture
  // pendant toute la soirée.
  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.publierDette) return;
    const surChangement = async () => {
      await chargerAttente();
      if (enAttenteRef.current) {
        publier({ victoire: "", defaite: "", enAttente: enAttenteRef.current });
      }
    };
    window.addEventListener("wow-dette-changee", surChangement);
    return () => window.removeEventListener("wow-dette-changee", surChangement);
  }, [chargerAttente, publier]);

  // Partie finie : la projection n'a plus d'objet, et l'effort qu'elle annonçait
  // vient de rejoindre ce qui est réellement dû.
  useEffect(() => {
    const pont = window.electronLOL;
    if (!pont?.onPartieTerminee || !pont.publierDette) return;
    return pont.onPartieTerminee(() => {
      derniereCleRef.current = "";
      publier(null);
    });
  }, [publier]);

  return null;
}
