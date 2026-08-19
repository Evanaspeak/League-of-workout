/**
 * Tout ce qui distingue une première visite d'un retour.
 *
 * Trois traces, deux stockages différents : l'écran d'ouverture ne dure que le
 * temps de l'onglet et vit donc en `sessionStorage`, tandis que la modale
 * d'accueil et la visite guidée doivent tenir d'une session à l'autre. Les
 * boutons « rejouer l'intro » les effaçaient à la main, chacun de leur côté —
 * et tous deux cherchaient l'écran d'ouverture dans le mauvais stockage, si
 * bien qu'il ne rejouait jamais.
 */
export function oublierPremiereVisite(): void {
  if (typeof window === "undefined") return;
  // Écran d'ouverture : session, pas local.
  sessionStorage.removeItem("splash");
  localStorage.removeItem("low_onboarded");
  localStorage.removeItem("low_visite");
}
