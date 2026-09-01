import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { estCheminPublic } from "@/lib/routesPubliques";
import { estPageConnue } from "@/lib/pagesConnues";
import {
  avecLocale, echappeAuPrefixe, localeDuChemin, negocierLocale, sansLocale,
} from "@/lib/i18n/cheminLocalise";

// On utilise le wrapper Auth.js pour lire la session (il sait déchiffrer le
// cookie JWT v5 — contrairement à getToken qui échouait et renvoyait tout le
// monde vers /login).
const { auth } = NextAuth(authConfig);

// Domaine canonique de production. Toute requête arrivant sur une URL de
// déploiement Vercel (ex: league-of-workout-xxxx-projects.vercel.app) est
// redirigée ici AVANT toute connexion. Sinon le cookie PKCE OAuth est posé sur
// le domaine de déploiement mais le callback Google arrive sur le domaine
// canonique → erreur "Invalid code verifier" → double connexion.
const CANONICAL_HOST =
  process.env.AUTH_CANONICAL_HOST ?? "winorworkout.com";


export default auth((req) => {
  const host = req.headers.get("host") ?? "";

  // Canonicalisation du domaine (uniquement pour les URLs Vercel, jamais en local).
  if (host.endsWith(".vercel.app") && host !== CANONICAL_HOST) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(url, 308);
  }

  const { pathname } = req.nextUrl;

  /**
   * La langue de l'adresse, d'abord.
   *
   * Ce qui échappe au préfixe passe tel quel : les routes d'API, l'adresse de
   * diffusion et les fichiers servis directement. Les préfixer casserait les
   * rappels d'Auth.js, l'application de bureau et les liens de diffusion déjà
   * collés chez les gens, pour un gain nul — personne ne les lit.
   */
  if (!echappeAuPrefixe(pathname)) {
    const portee = localeDuChemin(pathname);
    if (!portee) {
      // Adresse sans langue : on redirige vers celle qu'on a de meilleures
      // raisons de croire bonne. En 308 et non en 307 : c'est permanent, et un
      // moteur de recherche doit reporter le crédit de l'ancienne adresse sur
      // la nouvelle plutôt que de garder les deux.
      const langue = negocierLocale(
        req.cookies.get("low_locale")?.value,
        req.headers.get("accept-language"),
      );
      const url = req.nextUrl.clone();
      url.pathname = avecLocale(pathname, langue);

      /**
       * `/login` se RÉÉCRIT, il ne se redirige pas. Et c'est une dette qu'on
       * assume, pas une élégance.
       *
       * L'application Windows déjà installée ouvre sa fenêtre
       * d'authentification sur `${SITE}/login`, et décide « la connexion est
       * finie » en demandant « ce n'est plus /login ? ». Redirigée vers
       * `/fr/login`, elle répond oui à la toute première page : elle referme
       * la fenêtre avant qu'on ait tapé quoi que ce soit, et cherche un cookie
       * qui n'existe pas encore. La connexion par Google y devient impossible.
       *
       * Les copies installées ne se corrigent pas à distance. Une réécriture
       * garde l'adresse `/login` visible, donc l'ancien contrôle continue de
       * marcher, et la page rendue est bien celle de la bonne langue. Le prix
       * est nul côté moteurs : `/login` porte `noindex`, il n'y a aucun crédit
       * d'adresse à reporter.
       *
       * À retirer le jour où plus personne ne fait tourner une version
       * antérieure à 0.9.9 — pas avant.
       */
      if (pathname === "/login") return NextResponse.rewrite(url);

      return NextResponse.redirect(url, 308);
    }
  }

  /**
   * Le reste des règles ne connaît QUE le chemin sans langue.
   *
   * `estCheminPublic` a sa liste et sa comparaison par segments ; lui faire
   * connaître le préfixe reviendrait à écrire la règle deux fois, et c'est
   * précisément la divergence entre deux listes qui avait laissé quatre routes
   * partir en 307 vers /login pendant des semaines.
   */
  const chemin = sansLocale(pathname);

  // Routes publiques : accès libre. La liste et la règle qui la lit vivent
  // dans `src/lib/routesPubliques.ts`, pour que le test de la porte éprouve
  // la règle qui tourne plutôt qu'une copie de son côté.
  if (estCheminPublic(chemin)) {
    return NextResponse.next();
  }

  /**
   * Une adresse qui n'existe pas n'est pas une adresse protégée.
   *
   * Sans ce passage, `/fr/nimportequoi` répondait 307 vers `/fr/login` : une
   * faute de frappe ou un lien mort menaient à un écran de connexion, la page
   * 404 localisée était inatteignable pour qui n'a pas de session, et un
   * moteur qui suit un lien mort recevait 307 puis 200 — jamais 404, donc
   * l'adresse supprimée ne sortait jamais de l'index.
   *
   * Réservé aux PAGES. Ce qui échappe au préfixe de langue — les routes d'API
   * avant tout — garde le contrôle : y appliquer la même règle laisserait
   * passer sans session tout ce qui ne figure pas dans une liste de pages,
   * c'est-à-dire l'intégralité de l'API.
   */
  if (!echappeAuPrefixe(pathname) && !estPageConnue(chemin)) {
    return NextResponse.next();
  }

  // Routes protégées : req.auth est rempli par Auth.js si la session est valide.
  if (!req.auth) {
    const url = req.nextUrl.clone();
    // La connexion garde la langue de la page qu'on voulait ouvrir : y arriver
    // en anglais parce qu'on a été redirigé serait un changement de langue que
    // personne n'a demandé.
    url.pathname = avecLocale("/login", localeDuChemin(pathname) ?? "en");
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  // Tout ce qui est listé ici échappe à l'authentification. Le manifeste, le
  // service worker et les icônes d'installation doivent rester accessibles
  // sans session : le navigateur et le système les réclament parfois sans
  // envoyer les cookies, et un service worker redirigé vers /login ne
  // s'enregistre jamais.
  matcher: [
    // `videos/` : la vidéo de démonstration du héros. Sans elle, le fichier
    // partait vers /login comme n'importe quelle page protégée, et le lecteur
    // restait noir pour tout visiteur non connecté, c'est-à-dire pour tout le
    // monde sur la page d'accueil.
    //
    // Les exclusions portent sur des chemins précis, jamais sur une extension.
    // « .*\\.png$ » dispensait du contrôle TOUTE adresse finissant par .png —
    // y compris /api/admin/users/x.png, qui atteint bien son handler. Les
    // contrôles en place dans chaque handler rattrapaient le coup ; la
    // convention « les pages sont protégées par le middleware » était fausse.
    // `_vercel/` : le script de mesure d'audience. Il partait vers /login comme
    // une page protégée, et le navigateur refusait alors de l'exécuter — « MIME
    // type text/html is not executable ». La mesure ne remontait donc rien, et
    // rien ne le signalait : une page de connexion rendue en 200 ressemble à un
    // script qui s'est chargé. Trouvé en regardant la console pendant un test.
    "/((?!_next/static|_next/image|_vercel/|favicon\\.ico|riot\\.txt|robots\\.txt|sitemap\\.xml|manifest\\.webmanifest|sw\\.js|api/pwa-icon|opengraph-image|icon$|apple-icon$|icons/|images/|videos/).*)",
  ],
};
