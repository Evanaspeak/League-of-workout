import Image from "next/image";

/**
 * Une capture d'écran, posée dans une fenêtre.
 *
 * Une image brute collée dans une page se lit comme une illustration ; la même
 * image dans un cadre de fenêtre se lit comme un logiciel. C'est toute la
 * différence entre « voici un dessin » et « voici le produit ».
 *
 * Le cadre est sobre — trois pastilles, une barre de titre, rien d'autre : il
 * doit se faire oublier au profit de ce qu'il encadre.
 */
export function CadreApp({
  src, alt, titre, largeur, hauteur, priorite = false, tailles,
}: {
  src: string;
  alt: string;
  /** Ce que porte la barre de titre. Vide, elle sonne faux. */
  titre: string;
  largeur: number;
  hauteur: number;
  priorite?: boolean;
  tailles?: string;
}) {
  return (
    <figure className="cadre-app">
      <div className="cadre-app-barre">
        <span className="cadre-app-pastilles" aria-hidden>
          <i /><i /><i />
        </span>
        <span className="cadre-app-titre">{titre}</span>
      </div>
      <Image
        src={src}
        alt={alt}
        width={largeur}
        height={hauteur}
        priority={priorite}
        sizes={tailles ?? "(max-width: 960px) 100vw, 50vw"}
        className="cadre-app-image"
      />
    </figure>
  );
}
