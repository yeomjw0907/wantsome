import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  const { data: session } = await admin
    .from("call_sessions")
    .select("consumer_id, creator_id, status, per_min_rate, started_at")
    .eq("id", sessionId)
    .single();

  if (!session) return NextResponse.json({ message: "세션 없음" }, { status: 404 });
  if (session.consumer_id !== authUser.id && session.creator_id !== authUser.id) {
    return NextResponse.json({ message: "권한 없음" }, { status: 403 });
  }
  if (session.status !== "active") {
    return NextResponse.json({ message: "활성 세션이 아닙니다" }, { status: 400 });
  }

  const endedAt = new Date();
  const startedAt = session.started_at ? new Date(session.started_at) : endedAt;
  const duration_sec = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);
  const minutes = Math.floor(duration_sec / 60);
  const points_charged = minutes * session.per_min_rate;

  // 세션 종료 처리
  await admin
    .from("call_sessions")
    .update({
      status: "ended",
      ended_at: endedAt.toISOString(),
      duration_sec,
      points_charged,
    })
    .eq("id", sessionId);

  // 크리에이터 정산율 조회
  const { data: creator } = await admin
    .from("creators")
    .select("settlement_rate, monthly_minutes")
    .eq("id", session.creator_id)
    .single();

  const settlement_rate = creator?.settlement_rate ?? 0.75;
  const creator_earning = Math.floor(points_charged * settlement_rate);

  if (points_charged > 0) {
    // 소비자 포인트 차감
    await admin.rpc("deduct_points", {
      p_user_id: session.consumer_id,
      p_amount: points_charged,
    }).then(({ error }) => {
      if (error) {
        // rpc 없으면 직접 업데이트 fallback
        return admin.from("users")
          .select("points")
          .eq("id", session.consumer_id)
          .single()
          .then(({ data }) => {
            if (data) {
              return admin.from("users")
                .update({ points: Math.max(0, data.points - points_charged) })
                .eq("id", session.consumer_id);
            }
          });
      }
    });

    // 크리에이터 수익 및 통화 누적
    if (creator) {
      await admin
        .from("creators")
        .update({ monthly_minutes: (creator.monthly_minutes ?? 0) + minutes })
        .eq("id", session.creator_id);
    }
  }

  // 상대방에게 call_ended 신호
  const other_user_id =
    authUser.id === session.consumer_id ? session.creator_id : session.consumer_id;

  await admin.from("call_signals").insert({
    session_id: sessionId,
    to_user_id: other_user_id,
    from_user_id: authUser.id,
    type: "call_ended",
    payload: { duration_sec, points_charged, creator_earning },
  });

  return NextResponse.json({
    duration_sec,
    points_charged,
    creator_earning,
  });
}
