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
  const { data: participant } = await admin
    .from("live_room_participants")
    .select("role, status")
    .eq("room_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!participant || participant.status !== "joined") {
    return NextResponse.json({ success: true });
  }
  if (participant.role === "host") {
    return NextResponse.json({ message: "호스트는 종료 API를 사용해야 합니다." }, { status: 400 });
  }

  const { error } = await admin
    .from("live_room_participants")
    .update({
      status: "left",
      left_at: new Date().toISOString(),
    })
    .eq("room_id", id)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
