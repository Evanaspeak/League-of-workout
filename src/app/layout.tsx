import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Barlow, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { SplashScreen } from "@/components/SplashScreen";
import { RailLateral } from "@/components/RailLateral";
import { ServiceWorkerActif } from "@/components/ServiceWorkerActif";
import { PontDesktop } from "@/components/PontDesktop";
import { PontConnecte } from "@/components/PontConnecte";
import { Footer } from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next";
import { SessionProvider } from "@/lib/SessionContext";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";
import { RatiosExercicesProvider } from "@/components/RatiosExercices";
import { chargerRatios } from "@/lib/exercicesConfig";

/**
 * Titrage de la marque.
 *
 * Barlow Condensed tenait la place et faisait le travail, mais c'est l'un des
 * choix les plus repris du catalogue Google : elle ne disait rien du produit.
 * Chakra Petch a des angles coupés et des terminaisons biseautées — le même
 * geste que la barre oblique de la marque — et elle n'est pas condensée : les
 * titres tiennent plus de largeur, ce dont l'échelle typographique tient
 * compte.
 */
const titrage = Chakra_Petch({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const barlow = Barlow({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://winorworkout.com"),
  title: { default: "Win or Workout", template: "%s · Win or Workout" },
  description: "Tu gagnes ta game, ou tu paies en sueur. L'app qui convertit tes parties en entraînement.",
  applicationName: "Win or Workout",
  manifest: "/manifest.webmanifest",
  // Ajouté à l'écran d'accueil, le site s'ouvre sans barre de navigateur —
  // et c'est la seule façon de recevoir des notifications sur iPhone.
  appleWebApp: {
    capable: true,
    title: "Win//Workout",
    statusBarStyle: "black-translucent",
  },
  openGraph: {
    type: "website",
    siteName: "Win or Workout",
    locale: "fr_FR",
    url: "https://winorworkout.com",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: "#0C0E11",
  width: "device-width",
  initialScale: 1,
};

/**
 * Fenêtre de régénération des pages.
 *
 * La mise en page charge les ratios d'exercices, réglables depuis
 * l'administration. Sans cette valeur, les pages sans données propres au
 * compte sont figées à la génération : elles gardaient les ratios du déploiement
 * et aucune invalidation ne les rattrapait, parce qu'une route entièrement
 * statique n'écoute pas `revalidatePath`. Avec elle, l'invalidation prend effet
 * immédiatement, et cinq minutes servent de filet si elle échoue.
 */
export const revalidate = 300;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Les ratios d'exercices se règlent depuis l'administration. Les charger ici
  // les installe pour le rendu serveur de toute la page, et la valeur descend
  // au navigateur pour qu'il convertisse à l'identique.
  const ratios = await chargerRatios();

  return (
    <html lang="fr" className={`h-full ${titrage.variable} ${barlow.variable} ${plexMono.variable}`}>
      <head>
        {/*
          Attrape l'invite d'installation avant tout le reste.

          Le navigateur n'émet `beforeinstallprompt` qu'une seule fois, et ce
          moment ne se commande pas : il tombe souvent avant que le paquet
          JavaScript ne s'exécute. Un écouteur posé dans un composant, même au
          chargement de son module, arrive alors trop tard — et il n'y a pas de
          seconde émission. Ces quelques lignes sont dans la page elle-même
          parce que c'est le seul endroit qui soit assez tôt.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){window.addEventListener("beforeinstallprompt",function(e){`
              // Sans cela, Chrome pose sa propre barre en bas de l'écran, et il
              // y en aurait deux.
              + `e.preventDefault();window.__wowInvite=e;`
              + `window.dispatchEvent(new Event("wow-invite-installation"));});})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <RatiosExercicesProvider valeurs={ratios}>
        <LocaleProvider>
          <SessionProvider>
            <SplashScreen />
            {/* Tout ce qui ne s'adresse qu'à un compte connecté, chargé
                seulement hors des pages publiques. */}
            <PontConnecte />
            <Nav />
            <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">
              {children}
            </main>
            <Footer />
            <RailLateral />
            {/* Tout ce qui ne sert que dans l'application Windows, chargé
                seulement quand le pont existe. */}
            <PontDesktop />
            {/* Porte les notifications et la page de secours hors ligne :
                pour tout le monde, connecté ou non. */}
            <ServiceWorkerActif />
          </SessionProvider>
        </LocaleProvider>
        </RatiosExercicesProvider>
        {/* Mesure d'audience sans cookie ni identifiant persistant : elle ne
            permet pas de suivre quelqu'un d'une visite à l'autre, ce qui évite
            la bannière de consentement. Elle sert à savoir combien de monde
            arrive, sur quel système, et où les gens décrochent. */}
        <Analytics />
      </body>
    </html>
  );
}
