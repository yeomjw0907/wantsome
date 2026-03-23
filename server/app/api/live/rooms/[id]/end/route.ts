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

  const endedAt = new Date().toISOString();
  await admin.from("live_rooms").update({
    status: "ended",
    ended_at: endedAt,
  }).eq("id", id);

  await admin.from("creators").update({ is_live_now: false }).eq("id", user.id);
  await admin
    .from("live_room_participants")
    .update({ status: "left", left_at: endedAt })
    .eq("room_id", id)
    .eq("status", "joined");

  return NextResponse.json({ success: true, ended_at: endedAt });
}
