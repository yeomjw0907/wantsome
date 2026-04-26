import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedUser } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const user = await getAuthenticatedUser(token);
  if (!user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const { data: room } = await admin
    .from("live_rooms")
    .select("id, host_id, status")
    .eq("id", id)
    .single();

  if (!room) return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });
  if (room.host_id !== user.id) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  if (!["ready", "live"].includes(room.status)) {
    return NextResponse.json({ message: "이미 종료된 라이브입니다." }, { status: 400 });
  }

  // status 마크 + 환불 + audit + 남은 참가자 left 마크를 단일 RPC 안에서 처리
  // (race-safe: ended 마크 후에는 join 거절되므로 환불 빈틈 없음)
  const { data: endResult, error: endErr } = await admin
    .rpc("live_end_with_refund", { p_room_id: id, p_actor_id: user.id })
    .single() as unknown as {
      data: { prev_status: string; refunded_count: number; total_refunded: number } | null;
      error: { message: string } | null;
    };

  if (endErr || !endResult) {
    return NextResponse.json(
      { message: "라이브 종료 처리 실패", detail: endErr?.message ?? "unknown" },
      { status: 500 },
    );
  }

  // 호스트 라이브 상태 해제 (RPC 외부 — creators 테이블)
  await admin.from("creators").update({ is_live_now: false }).eq("id", user.id);

  return NextResponse.json({
    success: true,
    ended_at: new Date().toISOString(),
    refunded_count: endResult.refunded_count,
    total_refunded: endResult.total_refunded,
  });
}
