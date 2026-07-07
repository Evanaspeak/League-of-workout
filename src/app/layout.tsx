import type { Metadata } from "next";
import { Barlow_Condensed, Barlow, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { SplashScreen } from "@/components/SplashScreen";
import { SessionGuard } from "@/components/SessionGuard";
import { OnboardingModal } from "@/components/OnboardingModal";
import { Footer } from "@/components/Footer";
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
  title: { default: "Win or Workout", template: "%s — Win or Workout" },
  description: "Tu gagnes ta game, ou tu paies en pompes. L'app qui convertit tes parties en entraînement.",
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
          </SessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
