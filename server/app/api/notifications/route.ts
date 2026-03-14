/**
 * GET   /api/notifications           — 내 알림 목록 (최신 50건)
 * PATCH /api/notifications/read-all  — 전체 읽음 처리 (별도 route)
 * GET   /api/notifications?unread=1  — 읽지 않은 수
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error } = await supabase.auth.getUser(token);
  if (error || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const onlyCount = req.nextUrl.searchParams.get("unread") === "1";

  if (onlyCount) {
    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", authUser.id)
      .eq("is_read", false);
    return NextResponse.json({ unread_count: count ?? 0 });
  }

  const { data: notifications } = await admin
    .from("notifications")
    .select("id, type, title, body, data, is_read, created_at")
    .eq("user_id", authUser.id)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ notifications: notifications ?? [] });
}
