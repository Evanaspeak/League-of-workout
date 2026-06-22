import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import { SessionProvider } from "@/lib/SessionContext";

export const metadata: Metadata = {
  title: "League of Workouts",
  description: "Gamified fitness app for League of Legends players",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: "var(--lol-dark)" }}>
        <SessionProvider>
          <Nav />
          <main className="flex-1 px-4 py-6 max-w-6xl mx-auto w-full">
            {children}
          </main>
          <footer className="text-center py-3 text-xs" style={{ color: "rgba(200,170,110,0.4)" }}>
            Powered by Riot Games API · League of Workouts
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
