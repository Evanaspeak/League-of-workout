"use client";
import { useEffect, useRef, useState } from "react";
import { useMouvementReduit } from "@/lib/valeurClient";

/**
 * La vidéo de démonstration, en fond de héros.
 *
 * Elle a d'abord été posée en bloc encadré, sous le titre. En fond, elle est
 * plus juste : la démonstration occupe les trois premières secondes de la
 * page, là où le rapport dit que tout se joue, au lieu d'attendre qu'on
 * descende.
 *
 * Deux voiles la recouvrent. L'un, dense à gauche, garantit le contraste du
 * texte : une vidéo est claire par endroits et sombre ailleurs, et un titre
 * blanc posé dessus devient illisible dès qu'une image claire passe. L'autre,
 * en bas, raccorde la section à la suivante.
 *
 * Elle joue sans son, seul régime où un navigateur accepte de lancer une
 * vidéo tout seul. Le bouton reste : un fond animé qu'on ne peut pas arrêter
 * est une nuisance, et quelqu'un qui a demandé moins de mouvement ne la voit
 * pas partir du tout.
 */
export function VideoFond({
  sources, affiche, titre, lecture, pause,
}: {
  sources: { src: string; type: string }[];
  affiche: string | null;
  titre: string;
  lecture: string;
  pause: string;
}) {
  const mouvementReduit = useMouvementReduit();
  const video = useRef<HTMLVideoElement>(null);
  const [enLecture, setEnLecture] = useState(!mouvementReduit);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (mouvementReduit) { el.pause(); return; }
    // Un refus de lecture automatique n'est pas une panne : le bouton reste.
    el.play().catch(() => setEnLecture(false));
  }, [mouvementReduit]);

  const basculer = () => {
    const el = video.current;
    if (!el) return;
    if (el.paused) { el.play().catch(() => {}); setEnLecture(true); }
    else { el.pause(); setEnLecture(false); }
  };

  return (
    <>
      <div className="video-fond" aria-hidden={false}>
        <video
          ref={video}
          poster={affiche ?? undefined}
          muted
          loop
          playsInline
          preload={mouvementReduit ? "none" : "metadata"}
          aria-label={titre}
          onPlay={() => setEnLecture(true)}
          onPause={() => setEnLecture(false)}
        >
          {sources.map((s) => <source key={s.src} src={s.src} type={s.type} />)}
        </video>
        <span className="video-fond-voile" aria-hidden />
      </div>
      <button type="button" className="video-fond-bouton" onClick={basculer} aria-label={enLecture ? pause : lecture}>
        {enLecture ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13l11-6.5-11-6.5Z" /></svg>
        )}
        <span>{enLecture ? pause : lecture}</span>
      </button>
    </>
  );
}
