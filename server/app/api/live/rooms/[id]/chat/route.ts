import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedUser, isAdminRole, isMuteActive } from "@/lib/live";

export const dynamic = "force-dynamic";

async function getParticipantAccess(
  admin: ReturnType<typeof createSupabaseAdmin>,
  roomId: string,
  userId: string,
  userRole: string
) {
  const roomRes = await admin
    .from("live_rooms")
    .select("host_id, status, chat_locked")
    .eq("id", roomId)
    .single();

  if (!roomRes.data) return { error: "라이브를 찾을 수 없습니다.", status: 404 as const };

  const room = roomRes.data as any;
  if (room.status !== "live" && room.status !== "ended") {
    return { error: "채팅을 조회할 수 없는 상태입니다.", status: 400 as const };
  }

  const participantRes = await admin
    .from("live_room_participants")
    .select("role, status, chat_muted_until")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();

  const isHost = room.host_id === userId;
  const isAdmin = isAdminRole(userRole);
  const participant = participantRes.data as any;

  if (!isHost && !isAdmin && participant?.status !== "joined") {
    return { error: "입장자만 채팅을 사용할 수 있습니다.", status: 403 as const };
  }

  return {
    room,
    participant,
    role: isHost ? "host" : isAdmin ? "admin" : participant?.role ?? "viewer",
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const user = await getAuthenticatedUser(token);
  if (!user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const access = await getParticipantAccess(admin, id, user.id, user.role);
  if ("error" in access) return NextResponse.json({ message: access.error }, { status: access.status });

  const { data: messages, error } = await admin
    .from("live_chat_messages")
    .select(`
      id, sender_id, sender_role, message, created_at,
      users!inner(nickname, profile_img)
    `)
    .eq("room_id", id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({
    messages: (messages ?? []).map((item: any) => ({
      id: item.id,
      sender_id: item.sender_id,
      sender_role: item.sender_role,
      sender_name: item.users?.nickname ?? "사용자",
      sender_avatar_url: item.users?.profile_img ?? null,
      message: item.message,
      created_at: item.created_at,
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const user = await getAuthenticatedUser(token);
  if (!user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const body = await req.json() as { message?: string };
  const message = (body.message ?? "").trim().slice(0, 200);
  if (!message) return NextResponse.json({ message: "메시지를 입력해주세요." }, { status: 400 });

  const admin = createSupabaseAdmin();
  const access = await getParticipantAccess(admin, id, user.id, user.role);
  if ("error" in access) return NextResponse.json({ message: access.error }, { status: access.status });

  if (access.room.status !== "live") {
    return NextResponse.json({ message: "진행 중인 라이브에서만 채팅할 수 있습니다." }, { status: 400 });
  }
  if (access.role === "viewer" && access.room.chat_locked) {
    return NextResponse.json({ message: "현재 채팅이 잠겨 있습니다." }, { status: 403 });
  }
  if (access.role === "viewer" && isMuteActive(access.participant?.chat_muted_until)) {
    return NextResponse.json({ message: "현재 채팅이 제한되었습니다." }, { status: 403 });
  }

  const { data, error } = await admin
    .from("live_chat_messages")
    .insert({
      room_id: id,
      sender_id: user.id,
      sender_role: access.role,
      message,
    })
    .select("id, sender_id, sender_role, message, created_at")
    .single();

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ message: data }, { status: 201 });
}
