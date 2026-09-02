"use client";
import { useEffect } from "react";

/**
 * Révèle les sections au défilement, sans posséder leur contenu.
 *
 * L'observateur vivait dans la page d'accueil, ce qui la rendait cliente en
 * entier : ses six cents lignes de texte et son dictionnaire de mille cinq
 * cents lignes partaient donc dans le paquet JavaScript, dans les six langues,
 * pour un contenu qui ne bouge jamais.
 *
 * Il n'a pourtant besoin d'aucun de ces textes : il parcourt le DOM déjà rendu
 * et pose une classe. Séparé, il pèse quelques lignes et la page redevient du
 * HTML.
 *
 * Sans `IntersectionObserver`, tout est révélé d'emblée : mieux vaut une page
 * sans animation qu'une page vide. `@media (scripting: none)` traite déjà le
 * cas où ce script n'arrive pas du tout.
 */
export function RevelationAuDefilement() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".reveal"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("is-visible"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return null;
}
