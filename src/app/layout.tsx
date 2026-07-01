import type { Metadata } from "next";
import { Russo_One, Chakra_Petch } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import { SplashScreen } from "@/components/SplashScreen";
import { SessionGuard } from "@/components/SessionGuard";
import { OnboardingModal } from "@/components/OnboardingModal";
import { Footer } from "@/components/Footer";
import { SessionProvider } from "@/lib/SessionContext";
import { LocaleProvider } from "@/lib/i18n/LocaleContext";

const russoOne = Russo_One({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const chakraPetch = Chakra_Petch({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "League of Workouts",
  description: "Gamified fitness app for League of Legends players",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`h-full ${russoOne.variable} ${chakraPetch.variable}`}>
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
