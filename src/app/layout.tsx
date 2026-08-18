import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Barlow, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { SplashScreen } from "@/components/SplashScreen";
import { SessionGuard } from "@/components/SessionGuard";
import { OnboardingModal } from "@/components/OnboardingModal";
import { RailLateral } from "@/components/RailLateral";
import { MajDesktop } from "@/components/MajDesktop";
import { Footer } from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next";
import { SessionProvider } from "@/lib/SessionContext";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";

const barlowCondensed = Barlow_Condensed({
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
  title: { default: "Win or Workout", template: "%s — Win or Workout" },
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`h-full ${barlowCondensed.variable} ${barlow.variable} ${plexMono.variable}`}>
      <body className="min-h-full flex flex-col">
        <LocaleProvider>
          <SessionProvider>
            <SplashScreen />
            <SessionGuard />
            <OnboardingModal />
            <Nav />
            <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">
              {children}
            </main>
            <Footer />
            <RailLateral />
            {/* Ne s'affiche que dans l'application desktop, mise à jour prête. */}
            <MajDesktop />
          </SessionProvider>
        </LocaleProvider>
        {/* Mesure d'audience sans cookie ni identifiant persistant : elle ne
            permet pas de suivre quelqu'un d'une visite à l'autre, ce qui évite
            la bannière de consentement. Elle sert à savoir combien de monde
            arrive, sur quel système, et où les gens décrochent. */}
        <Analytics />
      </body>
    </html>
  );
}
