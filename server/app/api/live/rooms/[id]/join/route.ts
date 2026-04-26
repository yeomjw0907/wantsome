import { NextRequest, NextResponse } from "next/server";
import { AGORA_APP_ID, generateAgoraToken, isAgoraConfigured } from "@/lib/agora";
import { mapLiveJoinError } from "@/lib/liveRuntime";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedUser, getLiveConfig, isAdminRole } from "@/lib/live";

export const dynamic = "force-dynamic";

type JoinRpcResult = {
  success: boolean;
  error_code: string | null;
  charged_points: number;
  remaining_points: number;
  role: "viewer" | "admin";
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const user = await getAuthenticatedUser(token);
  if (!user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const [roomRes, config] = await Promise.all([
    admin
      .from("live_rooms")
      .select("id, host_id, status, agora_channel")
      .eq("id", id)
      .single(),
    getLiveConfig(),
  ]);

  type LiveRoomJoinRow = { id: string; host_id: string; status: string; agora_channel: string | null };
  const room = roomRes.data as unknown as LiveRoomJoinRow | null;
  if (!room) return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });
  if (room.status !== "live") return NextResponse.json({ message: "입장할 수 없는 상태입니다." }, { status: 400 });
  if (!room.agora_channel) return NextResponse.json({ message: "방송 채널이 준비되지 않았습니다." }, { status: 400 });
  if (room.host_id === user.id) {
    return NextResponse.json({ message: "호스트는 방송 시작 플로우로 입장합니다." }, { status: 400 });
  }

  if (!AGORA_APP_ID || !isAgoraConfigured()) {
    return NextResponse.json({ message: "Agora 설정이 완료되지 않았습니다." }, { status: 500 });
  }

  const uid = Math.floor(Math.random() * 100000) + 1;
  let agoraToken: string;
  try {
    agoraToken = await generateAgoraToken(room.agora_channel, uid, "subscriber");
  } catch (err) {
    return NextResponse.json(
      { message: "Agora 토큰 생성 실패", detail: (err as Error).message },
      { status: 500 },
    );
  }

  const isAdmin = isAdminRole(user.role);
  const { data: joinResult, error: joinError } = await admin
    .rpc("live_join_room", {
      p_room_id: id,
      p_user_id: user.id,
      p_is_admin: isAdmin,
    })
    .single();

  if (joinError) {
    return NextResponse.json({ message: joinError.message }, { status: 500 });
  }

  const result = joinResult as JoinRpcResult | null;
  if (!result?.success) {
    const mapped = mapLiveJoinError(result?.error_code);
    return NextResponse.json({ message: mapped.message }, { status: mapped.status });
  }

  return NextResponse.json({
    room_id: id,
    role: result.role,
    charged_points: result.charged_points,
    remaining_points: result.remaining_points,
    agora_channel: room.agora_channel,
    agora_token: agoraToken,
    agora_app_id: AGORA_APP_ID,
    join_ack_deadline_sec: config.joinAckTimeoutSec,
  });
}
