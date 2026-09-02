import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { avecLocale } from "@/lib/i18n/cheminLocalise";
import { toLocale } from "@/lib/i18n/langues";
import AdminChampionEditor from "./AdminChampionEditor";
import AdminUserList from "./AdminUserList";
import AdminSignalements from "./AdminSignalements";
import AdminMesures from "./AdminMesures";
import AdminTools from "./AdminTools";
import AdminSeuilDette from "./AdminSeuilDette";
import AdminRatiosExercices from "./AdminRatiosExercices";
import AdminHeader from "./AdminHeader";
import { estAdmin } from "@/lib/admin";


export const metadata = { title: "Admin · Win or Workout" };

/**
 * La redirection garde la langue de la page demandée.
 *
 * `redirect("/login")` renvoyait sur une adresse sans langue : le middleware
 * la rattrape et redirige vers la langue NÉGOCIÉE, pas vers celle qu'on était
 * en train de lire. Se faire déconnecter changerait donc de langue au passage.
 */
export default async function AdminPage(
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  const user = await getCurrentUser();
  if (!user || !estAdmin(user.email)) redirect(avecLocale("/", toLocale(locale)));

  return (
    <div className="space-y-6">
      <AdminHeader locale={locale} email={user.email} />
      <AdminMesures />
      <AdminUserList />
      <AdminSignalements />
      <AdminRatiosExercices />
      <AdminSeuilDette />
      <AdminChampionEditor />
      <AdminTools />
    </div>
  );
}
