import { redirect } from "next/navigation";
import { avecLocale } from "@/lib/i18n/cheminLocalise";
import { toLocale } from "@/lib/i18n/langues";
import { getCurrentUser } from "@/lib/auth-helpers";
import { AmisClient } from "./AmisClient";

/**
 * Les amis et les groupes.
 *
 * Rien à rendre au serveur : la page n'a aucun contenu qui ne dépende de la
 * liste, et la liste arrive en un appel. Ce que le serveur fait ici, c'est la
 * porte — et la redirection garde la langue de l'adresse demandée, sinon se
 * faire déconnecter changerait de langue au passage.
 */
export default async function AmisPage(
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(avecLocale("/login", toLocale(locale)));
  return <AmisClient />;
}
