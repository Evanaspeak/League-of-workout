import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Récupère l'utilisateur DB associé à la session courante (ou null).
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.user.findUnique({ where: { id: session.user.id } });
}
