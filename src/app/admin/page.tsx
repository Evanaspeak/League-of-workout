import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import AdminChampionEditor from "./AdminChampionEditor";
import AdminBetaApplications from "./AdminBetaApplications";
import AdminUserList from "./AdminUserList";
import AdminTools from "./AdminTools";
import AdminHeader from "./AdminHeader";

const ADMIN_EMAIL = "evantocquet@gmail.com";

export const metadata = { title: "Admin — League of Workouts" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || user.email !== ADMIN_EMAIL) redirect("/");

  return (
    <div className="space-y-6">
      <AdminHeader email={user.email} />
      <AdminBetaApplications />
      <AdminUserList />
      <AdminChampionEditor />
      <AdminTools />
    </div>
  );
}
