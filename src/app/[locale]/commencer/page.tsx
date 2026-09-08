import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { avecLocale } from "@/lib/i18n/cheminLocalise";
import { toLocale } from "@/lib/i18n/langues";

export const metadata = {
  title: "Commencer",
  robots: { index: false },
};

/**
 * L'aiguillage du bouton principal de la page d'accueil.
 *
 * **Pourquoi il existe.** La page d'accueil lisait la session pour choisir
 * entre « Créer mon compte » et « Mon espace ». Une lecture de session est une
 * lecture de la requête : elle rendait DYNAMIQUE la page la plus visitée du
 * produit, et la seule page publique qui ne fût pas prérendue. Mesuré en
 * production, huit relevés de chaque : à chaud l'écart n'est que de soixante
 * millisecondes, mais la page dynamique a rendu **1,42 s puis 2,11 s** sur
 * deux séries — le démarrage à froid de sa fonction — quand la page prérendue
 * n'a jamais dépassé 0,28 s.
 *
 * Et un démarrage à froid tombe exactement sur qui arrive de loin, c'est-à-dire
 * sur le premier visiteur, sur la page qui existe pour l'accueillir.
 *
 * **Ce qu'on ne fait PAS.** Laisser les trois boutons se corriger après
 * hydratation : quelqu'un de connecté verrait « Créer mon compte » sur sa
 * propre page d'accueil pendant un instant. Le propriétaire a répondu
 * « trouve autre chose », et c'est cette page-ci.
 *
 * **Ce qu'elle change.** Le bouton ne DÉCIDE plus, il DEMANDE. Son libellé et
 * son adresse sont figés dans le HTML prérendu ; la question « qui est-ce ? »
 * ne se pose qu'au clic, sur une adresse qui ne rend aucune page. Le
 * démarrage à froid, s'il a lieu, est payé par quelqu'un qui a déjà décidé
 * d'entrer — pas par celui qui découvre le produit.
 *
 * **Le libellé reste celui du nouveau venu**, et c'est assumé : une page
 * d'accueil existe pour les gens qui n'ont pas de compte. Quelqu'un de connecté
 * qui clique « Créer mon compte » atterrit sur son tableau de bord, ce qui est
 * ce qu'il voulait. Le lien de la barre, lui, connaît la session — il est
 * client, comme `Nav` l'est partout ailleurs, et un lien discret en haut à
 * droite ne se compare pas au bouton principal.
 */
export default async function Commencer(
  { params }: { params: Promise<{ locale: string }> },
) {
  const [{ locale }, session] = await Promise.all([params, auth()]);
  const langue = toLocale(locale);
  redirect(avecLocale(session?.user ? "/dashboard" : "/beta", langue));
}
