/**
 * POST /api/ratings
 * Consumer -> creator rating with four categories.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";
import {
  computeOverallCategoryAverage,
  hasAnyCategoryRating,
  type FourCategoryRatingRow,
} from "@/lib/ratings";

export const dynamic = "force-dynamic";

type RatingBody = {
  call_session_id: string;
  creator_id: string;
  comment?: string;
} & FourCategoryRatingRow;

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const {
    data: { user: authUser },
    error: authErr,
  } = await authClient.auth.getUser(token);
  if (authErr || !authUser) {
    return NextResponse.json({ message: "Invalid token" }, { status: 401 });
  }

  const body = (await req.json()) as RatingBody;
  const callSessionId = body.call_session_id;
  const creatorId = body.creator_id;

  if (!callSessionId || !creatorId) {
    return NextResponse.json({ message: "필수 값이 누락되었습니다." }, { status: 400 });
  }

  const ratingPayload: FourCategoryRatingRow = {
    "rating_호감": body["rating_호감"],
    "rating_신뢰": body["rating_신뢰"],
    "rating_매너": body["rating_매너"],
    "rating_매력": body["rating_매력"],
  };

  if (!hasAnyCategoryRating(ratingPayload)) {
    return NextResponse.json({ message: "최소 1개 카테고리 평점이 필요합니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const { data: session } = await admin
    .from("call_sessions")
    .select("id, consumer_id, creator_id, status")
    .eq("id", callSessionId)
    .single();

  if (!session) {
    return NextResponse.json({ message: "통화 기록을 찾을 수 없습니다." }, { status: 404 });
  }
  if (session.consumer_id !== authUser.id) {
    return NextResponse.json({ message: "본인의 통화만 평가할 수 있습니다." }, { status: 403 });
  }
  if (session.status !== "ended") {
    return NextResponse.json({ message: "종료된 통화만 평가할 수 있습니다." }, { status: 400 });
  }

  // Supabase type generation does not know the new Korean-named columns yet.
  type CreatorRatingRow = {
    call_session_id: string; consumer_id: string; creator_id: string;
    "rating_호감": number | null; "rating_신뢰": number | null;
    "rating_매너": number | null; "rating_매력": number | null;
    comment?: string | null;
  };

  const { error } = await (admin.from("creator_ratings").upsert(
    {
      call_session_id: callSessionId,
      consumer_id: authUser.id,
      creator_id: creatorId,
      "rating_호감": ratingPayload["rating_호감"] ?? null,
      "rating_신뢰": ratingPayload["rating_신뢰"] ?? null,
      "rating_매너": ratingPayload["rating_매너"] ?? null,
      "rating_매력": ratingPayload["rating_매력"] ?? null,
      comment: body.comment?.slice(0, 100) ?? null,
    } as unknown as CreatorRatingRow,
    { onConflict: "call_session_id" },
  ) as unknown as Promise<{ error: { message: string } | null }>);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const { data: allRatings } = await (admin
    .from("creator_ratings")
    .select("rating_호감, rating_신뢰, rating_매너, rating_매력")
    .eq("creator_id", creatorId) as unknown as Promise<{ data: FourCategoryRatingRow[] | null; error: unknown }>);

  const overall = computeOverallCategoryAverage(allRatings ?? []);
  if (overall !== null) {
    await admin.from("creators").update({ avg_rating: overall }).eq("id", creatorId);
  }

  return NextResponse.json({ success: true });
}
