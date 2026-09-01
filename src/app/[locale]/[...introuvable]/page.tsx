import { notFound } from "next/navigation";

/**
 * Tout ce qui, sous une langue, ne correspond à aucune page.
 *
 * Sans cette route, une adresse inventée n'est rattachée à AUCUN segment :
 * Next la résout à la racine, et la racine n'a plus de mise en page depuis que
 * la langue est dans l'adresse. On tombait donc sur le 404 intégré de Next —
 * `<html>` sans langue, « 404: This page could not be found. » en anglais pour
 * tout le monde — pendant que la page 404 du site, traduite en six langues,
 * restait inatteignable.
 *
 * Elle ne masque rien : dans le routeur de Next, un segment statique ou
 * dynamique l'emporte toujours sur un attrape-tout. Elle ne se déclenche que
 * lorsque plus rien d'autre ne correspond, ce qui est exactement sa raison
 * d'être.
 *
 * Elle ne figure PAS dans `PAGES_CONNUES` : ce n'est pas une page, c'est
 * l'absence de page. L'y mettre rendrait `estPageConnue` vrai pour n'importe
 * quelle adresse, et le middleware cesserait de distinguer « protégé » de
 * « inexistant » — c'est-à-dire qu'il redeviendrait ce qu'on vient de corriger.
 */
export default function Introuvable() {
  notFound();
}
