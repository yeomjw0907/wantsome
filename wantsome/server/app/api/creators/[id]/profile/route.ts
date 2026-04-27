/**
 * PATCH /api/creators/[id]/profile — 크리에이터 프로필 업데이트
 * (bio, available_times 등)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  // 본인만 수정 가능
  if (user.id !== id) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = await req.json() as {
    bio?: string | null;
    available_times?: string | null;
  };

  const updates: Record<string, unknown> = {};
  if ("bio" in body) updates.bio = body.bio;
  if ("available_times" in body) updates.available_times = body.available_times;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "변경할 내용이 없습니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("creators").update(updates).eq("id", id);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
