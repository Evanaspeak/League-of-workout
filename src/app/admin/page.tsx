import { getCurrentUser } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import AdminChampionEditor from "./AdminChampionEditor";
import AdminBetaApplications from "./AdminBetaApplications";
import AdminTools from "./AdminTools";

const ADMIN_EMAIL = "evantocquet@gmail.com";

export const metadata = { title: "Admin — League of Workouts" };

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user || user.email !== ADMIN_EMAIL) redirect("/");

  return (
    <div className="space-y-6">
      <h1 style={{
        fontFamily: "var(--font-heading, 'Russo One', sans-serif)",
        fontSize: "1.5rem",
        color: "#C8AA6E",
        letterSpacing: "0.18em",
      }}>
        ADMINISTRATION
      </h1>
      <div className="lol-panel p-4 space-y-1">
        <p className="text-xs" style={{ color: "rgba(200,170,110,0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          Accès restreint · {user.email}
        </p>
      </div>
      <AdminBetaApplications />
      <AdminChampionEditor />
      <AdminTools />
    </div>
  );
}
