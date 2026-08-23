"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { formaterCompact, toExerciceIds, ventiler, type Repartition } from "@/lib/exercices";
import { estPagePublique } from "@/lib/pagesPubliques";
import { titreAvecDette } from "@/lib/titreOnglet";

/**
 * Le compteur de dette dans le titre de l'onglet.
 *
 * C'est le rappel le moins coûteux qui existe : il ne notifie rien, ne réclame
 * aucune permission, et se voit dans la barre d'onglets quand la page est en
 * arrière-plan — c'est-à-dire précisément quand on est en train de jouer.
 *
 * Il se repose à chaque navigation : le routeur réécrit le titre, et le
 * compteur disparaîtrait au premier changement de page.
 */
export function TitreAvecDette() {
  const chemin = usePathname();
  const publique = estPagePublique(chemin);

  useEffect(() => {
    if (typeof document === "undefined") return;
    // Sur une page publique, personne n'est connecté : un compteur y serait
    // celui de la session précédente, ou rien du tout.
    if (publique) {
      document.title = titreAvecDette(document.title, null);
      return;
    }

    let vivant = true;

    const poser = (valeur: string | null) => {
      if (!vivant) return;
      document.title = titreAvecDette(document.title, valeur);
    };

    const relire = async () => {
      try {
        const r = await fetch("/api/dette");
        if (!r.ok) return;
        const dette = await r.json() as { points: number; repartition: Repartition };
        if ((Number(dette?.points) || 0) <= 0) { poser(null); return; }
        const lignes = ventiler(dette.repartition ?? {});
        // Un seul exercice : sa valeur suffit. Plusieurs : on prend le premier
        // plutôt que d'écrire « 19 · 2 min 10 » dans un onglet large de six
        // caractères.
        poser(lignes.length > 0
          ? lignes[0].valeur
          : formaterCompact(dette.points, toExerciceIds([])[0]));
      } catch { /* le prochain événement réessaiera */ }
    };

    void relire();
    window.addEventListener("wow-dette-changee", relire);
    return () => {
      vivant = false;
      window.removeEventListener("wow-dette-changee", relire);
      // On retire le compteur en partant : laisser « (38) » sur une page qui
      // ne le met plus à jour est pire que ne rien afficher.
      if (typeof document !== "undefined") {
        document.title = titreAvecDette(document.title, null);
      }
    };
  }, [publique, chemin]);

  return null;
}
