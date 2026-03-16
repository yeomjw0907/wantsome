import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface Body {
  token: string;
  phone: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { token, phone } = body;

    if (!token || !phone) {
      return NextResponse.json(
        { message: "token and phone required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdmin();
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      return NextResponse.json(
        { message: "Invalid or expired token" },
        { status: 401 }
      );
    }

    const id = authUser.id;
    // 닉네임: 끝 4자리 기반 (예: 유저1234)
    const digits = phone.replace("+82", "0").replace(/\D/g, "");
    const maskedNickname = digits.length >= 4 ? `유저${digits.slice(-4)}` : "유저";

    const { data: existing } = await supabase
      .from("users")
      .select("id, created_at")
      .eq("id", id)
      .single();

    const is_new = !existing;
    const first_charge_deadline = is_new
      ? new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      : null;

    // 동일 전화번호가 다른 계정(소셜 로그인 등)에 이미 등록된 경우 감지
    if (is_new) {
      const { data: phoneOwner } = await supabase
        .from("users")
        .select("id")
        .eq("phone", phone)
        .neq("id", id)
        .maybeSingle();

      if (phoneOwner) {
        return NextResponse.json(
          {
            error: "DUPLICATE_PHONE",
            message: "이미 가입된 전화번호입니다. 소셜 로그인을 이용해주세요.",
          },
          { status: 409 }
        );
      }
    }

    const { error: upsertError } = await supabase.from("users").upsert(
      {
        id,
        nickname: maskedNickname,
        profile_img: null,
        phone,
        ...(is_new && {
          first_charge_deadline,
          is_first_charged: false,
        }),
      },
      { onConflict: "id" }
    );

    if (upsertError) {
      // Postgres UNIQUE 제약 위반 (phone 컬럼) 감지
      if (upsertError.code === "23505" && upsertError.message.includes("phone")) {
        return NextResponse.json(
          {
            error: "DUPLICATE_PHONE",
            message: "이미 가입된 전화번호입니다. 소셜 로그인을 이용해주세요.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { message: upsertError.message },
        { status: 500 }
      );
    }

    const { data: userRow } = await supabase
      .from("users")
      .select(
        "id, nickname, profile_img, role, is_verified, blue_mode, red_mode, suspended_until, points, first_charge_deadline, is_first_charged"
      )
      .eq("id", id)
      .single();

    if (!userRow) {
      return NextResponse.json(
        { message: "User not found after upsert" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: {
        id: userRow.id,
        nickname: userRow.nickname,
        profile_img: userRow.profile_img,
        role: userRow.role ?? "consumer",
        is_verified: userRow.is_verified ?? false,
        blue_mode: userRow.blue_mode ?? true,
        red_mode: userRow.red_mode ?? false,
        suspended_until: userRow.suspended_until,
      },
      is_new,
      points: userRow.points ?? 0,
      first_charge_deadline: userRow.first_charge_deadline,
      is_first_charged: userRow.is_first_charged ?? false,
      access_token: token,
    });
  } catch {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
