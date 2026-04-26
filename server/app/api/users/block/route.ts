import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** GET — 본인이 차단한 사용자 목록 (Apple 2.1 UGC 차단 UI 필수)
 *
 * DB 스키마 (006_reports.sql:36): user_blocks(blocker_id, blocked_id)
 * API 응답 shape는 user_id로 normalize (UI 호환 유지)
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  const { data, error } = await admin
    .from("user_blocks")
    .select(
      "blocked_id, created_at, users:blocked_id (id, nickname, profile_img)",
    )
    .eq("blocker_id", authUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[users/block GET] failed", error);
    return NextResponse.json({ message: "차단 목록 조회 실패" }, { status: 500 });
  }

  type Row = {
    blocked_id: string;
    created_at: string;
    users: { id: string; nickname: string | null; profile_img: string | null } | null;
  };

  const blocks = ((data as unknown as Row[]) ?? []).map((row) => ({
    user_id: row.blocked_id,
    blocked_at: row.created_at,
    nickname: row.users?.nickname ?? "사용자",
    profile_img: row.users?.profile_img ?? null,
  }));

  return NextResponse.json({ blocks });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  let body: { target_id?: string };
  try {
    body = (await req.json()) as { target_id?: string };
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  if (!body.target_id) {
    return NextResponse.json({ message: "target_id 필수" }, { status: 400 });
  }
  if (body.target_id === authUser.id) {
    return NextResponse.json({ message: "자신을 차단할 수 없습니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  const { error } = await admin
    .from("user_blocks")
    .upsert({
      blocker_id: authUser.id,
      blocked_id: body.target_id,
      created_at: new Date().toISOString(),
    }, {
      onConflict: "blocker_id,blocked_id",
    });

  if (error) {
    console.error("[users/block POST] failed", error);
    return NextResponse.json({ message: "차단 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  let body: { target_id?: string };
  try {
    body = (await req.json()) as { target_id?: string };
  } catch {
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  }
  if (!body.target_id) {
    return NextResponse.json({ message: "target_id 필수" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  const { error } = await admin
    .from("user_blocks")
    .delete()
    .eq("blocker_id", authUser.id)
    .eq("blocked_id", body.target_id);

  if (error) {
    console.error("[users/block DELETE] failed", error);
    return NextResponse.json({ message: "차단 해제 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
