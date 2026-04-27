import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Provider = "google" | "apple" | "kakao";

interface Body {
  provider: Provider;
  token: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const { provider, token } = body;
    if (!provider || !token) {
      return NextResponse.json({ message: "provider and token required" }, { status: 400 });
    }
    if (!["google", "apple", "kakao"].includes(provider)) {
      return NextResponse.json({ message: "Invalid provider" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !authUser) {
      return NextResponse.json({ message: "Invalid or expired token" }, { status: 401 });
    }

    const id = authUser.id;
    const email = authUser.email ?? "";
    const nickname =
      authUser.user_metadata?.name ??
      authUser.user_metadata?.full_name ??
      authUser.user_metadata?.user_name ??
      email.split("@")[0] ??
      "유저";
    const profile_img =
      authUser.user_metadata?.avatar_url ??
      authUser.user_metadata?.picture ??
      null;

    const { data: existing } = await supabase.from("users").select("id, created_at").eq("id", id).single();
    const is_new = !existing;

    const first_charge_deadline = is_new
      ? new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString()
      : null;

    const { error: upsertError } = await supabase.from("users").upsert(
      {
        id,
        nickname,
        profile_img: profile_img ?? null,
        ...(is_new && {
          first_charge_deadline,
          is_first_charged: false,
        }),
      },
      { onConflict: "id" }
    );

    if (upsertError) {
      return NextResponse.json({ message: upsertError.message }, { status: 500 });
    }

    const { data: userRow } = await supabase
      .from("users")
      .select(
        "id, nickname, profile_img, role, is_verified, blue_mode, red_mode, suspended_until, points, first_charge_deadline, is_first_charged"
      )
      .eq("id", id)
      .single();

    if (!userRow) {
      return NextResponse.json({ message: "User not found after upsert" }, { status: 500 });
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
  } catch (e) {
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
