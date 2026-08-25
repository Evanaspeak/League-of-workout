/**
 * Tout ce qui distingue une première visite d'un retour.
 *
 * Trois traces, deux stockages différents : l'écran d'ouverture ne dure que le
 * temps de l'onglet et vit donc en `sessionStorage`, tandis que la modale
 * d'accueil et la visite guidée doivent tenir d'une session à l'autre.
 *
 * Ces deux dernières sont rattachées au COMPTE, pas au navigateur. Écrites
 * sous un nom fixe, elles disaient « ce navigateur a déjà vu l'intro » — ce
 * qui n'est pas la question posée. Sur un poste où l'on a déjà utilisé
 * l'application, un compte tout neuf n'avait donc droit à rien : ni accueil,
 * ni visite. C'est précisément le moment où l'on en a le plus besoin.
 */
import { effacer, effacerSession } from "./stockage";

/** Suffixe du compte, ou rien tant qu'on ne le connaît pas encore. */
function pour(cle: string, uid: string | null | undefined): string {
  return uid ? `${cle}:${uid}` : cle;
}

export function cleOnboarding(uid: string | null | undefined): string {
  return pour("low_onboarded", uid);
}

export function cleVisite(uid: string | null | undefined): string {
  return pour("low_visite", uid);
}

/**
 * Efface les marques pour rejouer l'intro.
 *
 * Les anciens noms sans compte sont retirés aussi : ils datent d'avant ce
 * rattachement et empêcheraient sinon l'intro de rejouer pour qui les porte
 * encore.
 */
export function oublierPremiereVisite(uid?: string | null): void {
  if (typeof window === "undefined") return;
  // Écran d'ouverture : session, pas local.
  effacerSession("splash");
  effacer("low_onboarded");
  effacer("low_visite");
  if (uid) {
    effacer(cleOnboarding(uid));
    effacer(cleVisite(uid));
  }
}
