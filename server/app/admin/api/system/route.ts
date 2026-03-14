import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  if (!adminRole) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const { data } = await admin.from("system_config").select("key, value, updated_at").order("key");
  const cfg: Record<string, string> = {};
  (data ?? []).forEach((r) => { cfg[r.key] = r.value; });

  return NextResponse.json({ config: cfg });
}

export async function POST(req: NextRequest) {
  const adminRole = req.headers.get("x-admin-role");
  const adminId = req.headers.get("x-admin-id");
  if (adminRole !== "superadmin" || !adminId) {
    return NextResponse.json({ message: "superadmin only" }, { status: 403 });
  }

  const body = await req.json() as Record<string, string>;
  const admin = createSupabaseAdmin();

  const updates = Object.entries(body).map(([key, value]) => ({
    key,
    value: String(value),
    updated_at: new Date().toISOString(),
  }));

  for (const update of updates) {
    await admin
      .from("system_config")
      .upsert(update, { onConflict: "key" });
  }

  // 관리자 로그 기록
  await admin.from("admin_logs").insert({
    admin_id: adminId,
    action: "SYSTEM_CONFIG_UPDATE",
    target_type: "system",
    detail: body,
  });

  return NextResponse.json({ ok: true });
}
