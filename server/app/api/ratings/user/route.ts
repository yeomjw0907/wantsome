/**
 * POST /api/ratings/user — 크리에이터 → 유저 평가 (4카테고리 별점)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function avgOfDefined(values: (number | null | undefined)[]): number | null {
  const defined = values.filter((v): v is number => typeof v === "number");
  if (defined.length === 0) return null;
  return defined.reduce((s, v) => s + v, 0) / defined.length;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();

  // 크리에이터 role 확인
  const { data: userRow } = await admin
    .from("users")
    .select("role")
    .eq("id", authUser.id)
    .single();

  const isCreator = ["creator", "both"].includes(userRow?.role ?? "");
  if (!isCreator) {
    return NextResponse.json({ message: "크리에이터만 유저를 평가할 수 있습니다." }, { status: 403 });
  }

  const body = await req.json();
  const {
    call_session_id,
    consumer_id,
    rating_호감,
    rating_신뢰,
    rating_매너,
    rating_매력,
  } = body as {
    call_session_id: string;
    consumer_id: string;
    rating_호감?: number;
    rating_신뢰?: number;
    rating_매너?: number;
    rating_매력?: number;
  };

  if (!call_session_id || !consumer_id) {
    return NextResponse.json({ message: "필수 값이 누락됐습니다." }, { status: 400 });
  }

  const hasAnyRating = [rating_호감, rating_신뢰, rating_매너, rating_매력].some(
    (v) => typeof v === "number" && v >= 1 && v <= 5
  );
  if (!hasAnyRating) {
    return NextResponse.json({ message: "최소 1개 카테고리 평점이 필요합니다." }, { status: 400 });
  }

  // 세션 확인
  const { data: session } = await admin
    .from("call_sessions")
    .select("id, consumer_id, creator_id, status")
    .eq("id", call_session_id)
    .single();

  if (!session) return NextResponse.json({ message: "통화 기록을 찾을 수 없습니다." }, { status: 404 });
  if (session.creator_id !== authUser.id) {
    return NextResponse.json({ message: "본인의 통화만 평가할 수 있습니다." }, { status: 403 });
  }
  if (session.status !== "ended") {
    return NextResponse.json({ message: "완료된 통화만 평가할 수 있습니다." }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin_ = admin as any;

  const { error } = await admin_.from("user_ratings").upsert(
    {
      call_session_id,
      creator_id: authUser.id,
      consumer_id,
      rating_호감: rating_호감 ?? null,
      rating_신뢰: rating_신뢰 ?? null,
      rating_매너: rating_매너 ?? null,
      rating_매력: rating_매력 ?? null,
    },
    { onConflict: "call_session_id" }
  );

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  // users.avg_rating 재계산
  type RatingRow = { rating_호감: number | null; rating_신뢰: number | null; rating_매너: number | null; rating_매력: number | null };
  const { data: allRatings } = (await admin_.from("user_ratings")
    .select("rating_호감, rating_신뢰, rating_매너, rating_매력")
    .eq("consumer_id", consumer_id)) as { data: RatingRow[] | null };

  if (allRatings && allRatings.length > 0) {
    const rowAvgs = allRatings.map((r) =>
      avgOfDefined([r.rating_호감, r.rating_신뢰, r.rating_매너, r.rating_매력])
    ).filter((v): v is number => v !== null);

    if (rowAvgs.length > 0) {
      const overall = rowAvgs.reduce((s, v) => s + v, 0) / rowAvgs.length;
      await admin_.from("users").update({ avg_rating: Math.round(overall * 10) / 10 }).eq("id", consumer_id);
    }
  }

  return NextResponse.json({ success: true });
}
