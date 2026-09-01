"use client";
import { Lien } from "@/components/Lien";
import { useT } from "@/lib/i18n/LocaleContext";
import { layout } from "@/lib/i18n/dictionaries/layout";

/**
 * Une adresse qui ne mène nulle part, dans la langue de la page.
 *
 * Elle vit sous `[locale]` et non à la racine : c'est ce qui lui donne la mise
 * en page, la police et la langue du reste du site. Le 404 de la racine
 * existe toujours, mais on ne l'atteint plus qu'avec un chemin qui échappe au
 * préfixe — une route d'API inconnue, où il n'y a personne à qui parler.
 *
 * Une page qui ferme une porte doit en ouvrir une autre : le bouton ramène à
 * l'accueil, dans la même langue.
 */
export default function Introuvable() {
  const t = useT(layout);
  return (
    <div style={{ maxWidth: 460, margin: "12vh auto", textAlign: "center" }}
      className="flex flex-col gap-4">
      <p className="mono-num" style={{ color: "var(--steel)", letterSpacing: "0.2em" }}>404</p>
      <h1 className="titre-page">{t.introuvableTitre}</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.6 }}>{t.introuvableTexte}</p>
      <div>
        <Lien href="/" className="lol-btn" style={{ padding: "12px 28px" }}>
          {t.introuvableRetour}
        </Lien>
      </div>
    </div>
  );
}
