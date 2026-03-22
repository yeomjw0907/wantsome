/**
 * GET /api/creators/[id]/reviews — 크리에이터 리뷰 목록
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** 공개 리뷰 목록 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  const admin = createSupabaseAdmin();
  const { data, error, count } = await admin
    .from("creator_ratings")
    .select(
      "id, rating, comment, created_at, consumer_id, users!consumer_id(nickname, profile_img)",
      { count: "exact" }
    )
    .eq("creator_id", id)
    .not("comment", "is", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const reviews = (data ?? []).map((r: any) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    created_at: r.created_at,
    reviewer_nickname: r.users?.nickname ?? "익명",
    reviewer_avatar: r.users?.profile_img ?? null,
  }));

  return NextResponse.json({ reviews, total: count ?? 0, hasMore: offset + limit < (count ?? 0) });
}
