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
    // 첫충전 보너스 이벤트 비활성 (정책 변경, 2026-04-26)
    // 코드/DB 컬럼은 보존 — 향후 이벤트 재개 시 deadline 세팅 복원
    const first_charge_deadline: string | null = null;

    const DUPLICATE_PHONE = {
      error: "DUPLICATE_PHONE",
      message: "이미 가입된 전화번호입니다. 소셜 로그인을 이용해주세요.",
    } as const;

    // 동일 전화번호가 다른 계정(소셜 로그인 등)에 이미 등록된 경우 감지
    // is_new 여부와 무관하게 체크 (기존 유저가 타인 번호로 변경하는 경우도 포함)
    const { data: phoneOwner } = await supabase
      .from("users")
      .select("id")
      .eq("phone", phone)
      .neq("id", id)
      .maybeSingle();

    if (phoneOwner) {
      return NextResponse.json(DUPLICATE_PHONE, { status: 409 });
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
      // Postgres UNIQUE 제약 위반 (phone 컬럼) — 경쟁 조건 방어
      if (upsertError.code === "23505" && upsertError.message.includes("phone")) {
        return NextResponse.json(DUPLICATE_PHONE, { status: 409 });
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
