import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-helpers";
import { seedDefaults } from "@/lib/seed-defaults";
import { comptePublic } from "@/lib/compte";
import { estAdmin } from "@/lib/admin";
import { chargerRatios } from "@/lib/exercicesConfig";
import { reponseConsentement, reponseDette } from "@/lib/contexteConnecte";

/**
 * Tout ce qu'un écran connecté demandait en trois fois.
 *
 * `/api/user`, `/api/dette` et `/api/consentement` sont appelées à CHAQUE
 * chargement d'une page connectée, et les trois commencent pareil : lire la
 * session, puis lire le compte. Mesuré sur le serveur, un tableau de bord
 * faisait neuf appels d'API, dont trois pour ces routes-là et deux fois la
 * même — le compteur de dette et le titre de l'onglet la demandaient chacun de
 * leur côté.
 *
 * En production, chaque requête SQL est un appel HTTPS indépendant vers Neon :
 * le client passe par `PrismaNeonHttp` et non par un pool. Trois lectures du
 * même enregistrement ne coûtent donc pas trois fois rien, elles coûtent trois
 * allers-retours.
 *
 * Les trois routes d'origine RESTENT : elles portent les écritures, et
 * l'application de bureau comme les tests les appellent. Ce qui ne se dédouble
 * pas, c'est la mise en forme — elle vit dans `src/lib/contexteConnecte.ts`, et
 * les deux chemins la lisent. Deux exemplaires d'une règle finissent toujours
 * par diverger, et c'est le défaut le plus souvent trouvé sur ce projet.
 */
export async function GET() {
  /**
   * La session AVANT tout le reste.
   *
   * Le semis et les ratios partaient d'abord, donc une requête sans session
   * faisait travailler la base avant de se faire refuser. Le middleware
   * n'ouvre pas cette adresse aux anonymes, donc ce n'était pas une porte —
   * mais rien ne demande de faire ce travail-là pour quelqu'un qu'on va
   * éconduire, et une route qui agit avant de savoir à qui elle parle est une
   * mauvaise habitude à prendre.
   */
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // Sur une base neuve, la configuration du barème n'existe pas encore. Le
  // semis est mémoïsé pour le processus : après le premier appel, il ne coûte
  // qu'une promesse déjà résolue.
  await seedDefaults();
  // La dette s'exprime en temps d'effort : sans les ratios réglés en
  // administration, la durée rendue serait celle des valeurs d'origine.
  await chargerRatios();

  return NextResponse.json({
    /**
     * `comptePublic` et non `{ ...user }` : le jeton de diffusion est un
     * laissez-passer, et cette réponse part à chaque chargement de page. Il
     * finirait dans le cache du navigateur et dans l'onglet réseau, sur un
     * produit dont la fonction est de s'afficher en direct.
     */
    user: { ...comptePublic(user), estAdmin: estAdmin(user.email) },
    dette: reponseDette(user),
    consentement: reponseConsentement(user),
  });
}
