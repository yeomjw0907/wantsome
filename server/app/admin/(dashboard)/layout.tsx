import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseAdmin } from "@/lib/supabase";
import Sidebar from "../components/Sidebar";

async function getAdminStats() {
  const admin = createSupabaseAdmin();

  const [pendingCreators, pendingReports] = await Promise.all([
    admin.from("creator_profiles").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    admin.from("reports").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
  ]);

  return {
    pendingCreators: pendingCreators.count ?? 0,
    pendingReports: pendingReports.count ?? 0,
  };
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const role = headersList.get("x-admin-role") ?? "admin";

  const stats = await getAdminStats();

  return (
    <div className="admin-shell">
      <Sidebar
        role={role}
        pendingCreators={stats.pendingCreators}
        pendingReports={stats.pendingReports}
      />
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
