"use client";
import { useMouvementReduit } from "@/lib/valeurClient";

/**
 * Le produit en perspective, plutôt qu'une forme abstraite.
 *
 * Les volumes flottants et les dégradés de verre sont devenus la signature des
 * pages d'accueil fabriquées à la chaîne : ils donnent l'impression du sérieux
 * quelques secondes, puis exactement l'inverse. Ce qui distingue une page, c'est
 * ce qu'elle seule peut montrer.
 *
 * Ici, deux surfaces réelles du produit posées dans le même espace : le
 * relevé d'une soirée en arrière-plan, et la pastille d'overlay en avant, plus
 * près de l'œil. Aucune bibliothèque 3D, aucune image — de la géométrie CSS,
 * donc net à toutes les résolutions et sans un octet de plus à charger.
 *
 * Les deux plans partagent la MÊME rotation : c'est ce qui leur donne un point
 * de fuite commun. Des angles différents et l'œil voit deux images collées
 * l'une sur l'autre, jamais une scène.
 */

/** Rotation commune aux deux plans. Leur seule différence est la profondeur. */
const ROTATION = "rotateY(-15deg) rotateX(5deg)";

export function SceneProduit({
  carte,
  pastille,
}: {
  /** Plan de fond : le relevé de la soirée. */
  carte: React.ReactNode;
  /** Plan avant : la pastille affichée par-dessus le jeu. */
  pastille: React.ReactNode;
}) {
  // Une scène en perspective peut gêner ; sans mouvement demandé, on retombe
  // sur deux cartes à plat, empilées simplement.
  const aPlat = useMouvementReduit();

  return (
    <div
      className="scene-produit"
      style={{
        position: "relative",
        width: "100%",
        // La perspective se règle ici : plus la valeur est basse, plus l'effet
        // est marqué. 1500 donne un objectif long, sans déformation.
        perspective: aPlat ? undefined : 1500,
        perspectiveOrigin: "70% 40%",
      }}
    >
      <div
        className="scene-carte"
        style={{
          transform: aPlat ? undefined : `${ROTATION} translateZ(-40px)`,
          transformStyle: "preserve-3d",
          // Deux ombres : une proche et dense qui pose l'objet, une lointaine
          // et diffuse qui creuse l'espace derrière lui.
          filter: aPlat
            ? undefined
            : "drop-shadow(0 18px 30px rgba(0,0,0,0.45)) drop-shadow(0 60px 90px rgba(0,0,0,0.35))",
        }}
      >
        {carte}
      </div>

      {/* La pastille chevauche la carte et déborde du cadre : un objet cadré
          au millimètre au centre se lit comme un montage, pas comme une photo.

          Elle sort par le HAUT et non par le bas : en bas, elle recouvrait la
          ligne « dette totale », c'est-à-dire le chiffre qui justifie toute la
          carte. En haut, elle ne cache qu'un décompte d'activités. */}
      <div
        className="scene-pastille"
        style={{
          position: "absolute",
          right: "-8%",
          top: "-13%",
          transform: aPlat ? undefined : `${ROTATION} translateZ(120px)`,
          transformStyle: "preserve-3d",
          // Plus près de l'œil, donc ombre plus large et plus douce.
          filter: aPlat
            ? undefined
            : "drop-shadow(0 26px 40px rgba(0,0,0,0.55)) drop-shadow(0 8px 14px rgba(0,0,0,0.4))",
        }}
      >
        {pastille}
      </div>
    </div>
  );
}
