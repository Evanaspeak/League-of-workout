import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import AdminChampionEditor from "./AdminChampionEditor";
import AdminUserList from "./AdminUserList";
import AdminTools from "./AdminTools";
import AdminSeuilDette from "./AdminSeuilDette";
import AdminRatiosExercices from "./AdminRatiosExercices";
import AdminHeader from "./AdminHeader";
import { estAdmin } from "@/lib/admin";


export const metadata = { title: "Admin · Win or Workout" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || !estAdmin(user.email)) redirect("/");

  return (
    <div className="space-y-6">
      <AdminHeader email={user.email} />
      <AdminUserList />
      <AdminRatiosExercices />
      <AdminSeuilDette />
      <AdminChampionEditor />
      <AdminTools />
    </div>
  );
}
