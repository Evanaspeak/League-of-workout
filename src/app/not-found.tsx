import { CorpsIntrouvable } from "@/components/CorpsIntrouvable";

/**
 * Le dernier recours, et il ne doit jamais servir.
 *
 * Les adresses inconnues sont réécrites par le middleware vers
 * `/{langue}/introuvable`, qui est une vraie page, prérendue dans les six
 * langues et servie avec un code 404. Cette frontière-ci ne reste que pour ce
 * que le middleware ne voit pas — un `notFound()` levé depuis une page, ce
 * qu'aucun chemin n'atteint aujourd'hui : le catalogue des jeux est fermé par
 * le routeur avant d'y arriver, et un premier segment qui n'est pas une langue
 * est réécrit lui aussi.
 *
 * **Elle ne lit RIEN de la requête, et c'est toute la raison de ce fichier.**
 * Une frontière `not-found` de racine fait partie de l'arbre de rendu de
 * CHAQUE route : un `headers()` posé ici rend l'application entière dynamique.
 * C'est ce qui est arrivé — 144 pages, dont les 96 du calculateur, ont cessé
 * d'être prérendues sans que rien ne le signale, pendant que le journal
 * continuait d'annoncer « 228 pages statiques ». `src/quatreCentQuatre.test.ts`
 * refuse le retour d'une API dynamique ici.
 *
 * Elle porte donc l'anglais, faute de savoir dans quelle langue on est, et son
 * propre `<html>` : une frontière de racine sans mise en page racine doit
 * fournir le document entier.
 */
export default function Introuvable() {
  return (
    <html lang="en">
      <body style={{
        margin: 0, minHeight: "100vh", display: "flex", alignItems: "center",
        justifyContent: "center", background: "#0C0E11", color: "#ECEFF4",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}>
        <CorpsIntrouvable locale="en" />
      </body>
    </html>
  );
}
