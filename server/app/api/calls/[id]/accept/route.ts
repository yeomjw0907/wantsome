import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";
import { generateAgoraToken, makeChannelName, AGORA_APP_ID } from "@/lib/agora";
import { assertUserGate } from "@/lib/userGate";

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

  // 통화 수락 게이트 (크리에이터 측): 19세+ + 미정지 + PortOne 본인인증 강제
  // 크리에이터가 정지 또는 미인증이면 통화 자체 차단
  const gateReject = await assertUserGate(admin, authUser.id, { requireVerified: true });
  if (gateReject) return gateReject;

  // 세션 조회 (크리에이터 본인 확인)
  const { data: session } = await admin
    .from("call_sessions")
    .select("id, consumer_id, creator_id, mode, per_min_rate, status")
    .eq("id", sessionId)
    .single();

  if (!session) {
    return NextResponse.json({ message: "세션을 찾을 수 없습니다" }, { status: 404 });
  }
  if (session.creator_id !== authUser.id) {
    return NextResponse.json({ message: "권한 없음" }, { status: 403 });
  }
  if (session.status !== "pending") {
    return NextResponse.json({ message: "이미 처리된 세션입니다" }, { status: 400 });
  }

  // Agora 채널 + 토큰 생성 (cert 미설정 시 500)
  const channelName = makeChannelName(sessionId);
  const uid = Math.floor(Math.random() * 100000);
  let agoraToken: string;
  try {
    agoraToken = await generateAgoraToken(channelName, uid);
  } catch (err) {
    return NextResponse.json(
      { message: "Agora 토큰 생성 실패", detail: (err as Error).message },
      { status: 500 },
    );
  }

  // 세션 상태 → active
  await admin
    .from("call_sessions")
    .update({
      status: "active",
      agora_channel: channelName,
      started_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  // 크리에이터 is_busy=true (통화 중 상태 표시)
  await admin.from("creators").update({ is_busy: true }).eq("id", session.creator_id);

  // 소비자에게 call_accepted 신호
  await admin.from("call_signals").insert({
    session_id: sessionId,
    to_user_id: session.consumer_id,
    from_user_id: authUser.id,
    type: "call_accepted",
    payload: {
      agora_channel: channelName,
      agora_token: agoraToken,
      agora_app_id: AGORA_APP_ID,
    },
  });

  return NextResponse.json({
    session_id: sessionId,
    agora_channel: channelName,
    agora_token: agoraToken,
    agora_app_id: AGORA_APP_ID,
    per_min_rate: session.per_min_rate,
  });
}
