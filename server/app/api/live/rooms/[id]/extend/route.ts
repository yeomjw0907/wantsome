import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedUser, getLiveConfig } from "@/lib/live";

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

  const { added_duration_min } = await req.json() as { added_duration_min?: number };
  if (![30, 60].includes(Number(added_duration_min))) {
    return NextResponse.json({ message: "연장 시간은 30분 또는 1시간만 가능합니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const [roomRes, config] = await Promise.all([
    admin
      .from("live_rooms")
      .select("id, host_id, status, scheduled_end_at, extension_count")
      .eq("id", id)
      .single(),
    getLiveConfig(),
  ]);

  const room = roomRes.data as any;
  if (!room) return NextResponse.json({ message: "라이브를 찾을 수 없습니다." }, { status: 404 });
  if (room.host_id !== user.id) return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  if (room.status !== "live") return NextResponse.json({ message: "진행 중인 라이브만 연장할 수 있습니다." }, { status: 400 });
  if ((room.extension_count ?? 0) >= config.maxExtensionCount) {
    return NextResponse.json({ message: "최대 연장 횟수를 초과했습니다." }, { status: 400 });
  }

  const previousEndAt = new Date(room.scheduled_end_at);
  const newEndAt = new Date(previousEndAt.getTime() + Number(added_duration_min) * 60 * 1000);

  await admin.from("live_rooms").update({
    scheduled_end_at: newEndAt.toISOString(),
    extension_count: (room.extension_count ?? 0) + 1,
  }).eq("id", id);

  await admin.from("live_extensions").insert({
    room_id: id,
    actor_user_id: user.id,
    added_duration_min: Number(added_duration_min),
    previous_end_at: previousEndAt.toISOString(),
    new_end_at: newEndAt.toISOString(),
  });

  return NextResponse.json({
    success: true,
    extension_count: (room.extension_count ?? 0) + 1,
    previous_end_at: previousEndAt.toISOString(),
    new_end_at: newEndAt.toISOString(),
  });
}
