import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const supabase = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  const { data: creator, error } = await admin
    .from("creators")
    .select(`
      id, display_name, grade, is_online, mode_blue, mode_red,
      settlement_rate, monthly_minutes, bio, created_at,
      avg_rating, total_call_duration, response_rate, categories, available_times,
      users!inner(nickname, profile_img, is_verified)
    `)
    .eq("id", id)
    .single();

  if (error || !creator) {
    return NextResponse.json({ message: "크리에이터를 찾을 수 없습니다" }, { status: 404 });
  }

  // 총 통화 수 + 평균 통화 시간
  const { data: callStats } = await admin
    .from("call_sessions")
    .select("duration_sec")
    .eq("creator_id", id)
    .eq("status", "ended");

  const totalCalls = callStats?.length ?? 0;
  const avgCallSec = totalCalls > 0
    ? Math.round((callStats ?? []).reduce((s, c) => s + (c.duration_sec ?? 0), 0) / totalCalls)
    : 0;

  // 포스트 수
  const { count: postCount } = await admin
    .from("posts")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", id)
    .eq("is_deleted", false);

  const u = (creator as any).users ?? {};
  const c = creator as any;

  return NextResponse.json({
    id:                  creator.id,
    display_name:        creator.display_name ?? u.nickname ?? "크리에이터",
    profile_image_url:   u.profile_img ?? null,
    bio:                 c.bio ?? null,
    grade:               creator.grade ?? "신규",
    is_online:           creator.is_online ?? false,
    mode_blue:           creator.mode_blue ?? true,
    mode_red:            creator.mode_red ?? false,
    is_verified:         u.is_verified ?? false,
    rate_per_min:        900,
    total_calls:         totalCalls,
    monthly_minutes:     creator.monthly_minutes ?? 0,
    avg_call_min:        Math.round(avgCallSec / 60),
    avg_rating:          c.avg_rating ?? 0,
    categories:          c.categories ?? [],
    post_count:          postCount ?? 0,
    settlement_rate:     creator.settlement_rate ?? 0.75,
    available_times:     c.available_times ?? null,
  });
}
