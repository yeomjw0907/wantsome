import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !authUser) {
    return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("users")
    .select(
      "id, nickname, profile_img, role, is_verified, blue_mode, red_mode, suspended_until, points, first_charge_deadline, is_first_charged, bio"
    )
    .eq("id", authUser.id)
    .single();

  if (error || !row) {
    return NextResponse.json({ message: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    nickname: row.nickname,
    profile_img: row.profile_img,
    role: row.role ?? "consumer",
    is_verified: row.is_verified ?? false,
    blue_mode: row.blue_mode ?? true,
    red_mode: row.red_mode ?? false,
    suspended_until: row.suspended_until,
    points: row.points ?? 0,
    first_charge_deadline: row.first_charge_deadline,
    is_first_charged: row.is_first_charged ?? false,
    bio: row.bio ?? null,
  });
}

// 프로필 수정 (닉네임, 프로필 이미지)
export async function PATCH(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const body = await req.json() as {
    nickname?: string;
    profile_img?: string;
    bio?: string;
  };

  const updateData: Record<string, string | null> = {};
  if (body.nickname !== undefined) {
    if (body.nickname.length < 2 || body.nickname.length > 20) {
      return NextResponse.json({ message: "닉네임은 2~20자 이하여야 합니다." }, { status: 400 });
    }
    updateData.nickname = body.nickname;
  }
  if (body.profile_img !== undefined) {
    updateData.profile_img = body.profile_img;
  }
  if (body.bio !== undefined) {
    if (body.bio.length > 200) {
      return NextResponse.json({ message: "자기소개는 200자 이하여야 합니다." }, { status: 400 });
    }
    updateData.bio = body.bio || null;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ message: "변경할 내용이 없습니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("users")
    .update(updateData)
    .eq("id", authUser.id);

  if (error) {
    return NextResponse.json({ message: "프로필 업데이트 실패" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// 회원 탈퇴
export async function DELETE(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  // 진행 중인 통화 확인
  const { data: activeCalls } = await admin
    .from("call_sessions")
    .select("id")
    .eq("consumer_id", authUser.id)
    .in("status", ["pending", "active"])
    .limit(1);

  if (activeCalls && activeCalls.length > 0) {
    return NextResponse.json({ message: "진행 중인 통화가 있어 탈퇴할 수 없습니다." }, { status: 409 });
  }

  // soft delete: deleted_at 설정
  const { error } = await admin
    .from("users")
    .update({
      deleted_at: new Date().toISOString(),
      nickname: `탈퇴회원_${authUser.id.slice(0, 8)}`,
      profile_img: null,
    })
    .eq("id", authUser.id);

  if (error) {
    return NextResponse.json({ message: "탈퇴 처리 실패" }, { status: 500 });
  }

  // Supabase Auth 계정 삭제
  await admin.auth.admin.deleteUser(authUser.id);

  return NextResponse.json({ success: true });
}
