import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Le middleware utilise la config edge-safe (sans Prisma) pour protéger les
// routes : toute page hors /login, /waitlist et /api/auth exige une session.
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
};
