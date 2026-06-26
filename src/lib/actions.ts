"use server";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function logout() {
  await signOut({ redirectTo: "/login" });
}

// Suppression de compte (RGPD). Efface l'utilisateur ; les comptes OAuth,
// sessions, parties et objectifs liés sont supprimés en cascade (onDelete: Cascade).
// Déconnecte ensuite pour effacer le cookie de session et rediriger vers /login.
export async function deleteAccount() {
  const session = await auth();
  if (!session?.user?.id) {
    await signOut({ redirectTo: "/login" });
    return;
  }
  await prisma.user.delete({ where: { id: session.user.id } });
  await signOut({ redirectTo: "/login?deleted=1" });
}
