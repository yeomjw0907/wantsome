/**
 * POST /api/ratings — 통화 후 평점 제출
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const body = await req.json();
  const { call_session_id, creator_id, rating } = body as {
    call_session_id: string;
    creator_id: string;
    rating: number;
  };

  if (!call_session_id || !creator_id || !rating) {
    return NextResponse.json({ message: "필수 값이 누락됐습니다." }, { status: 400 });
  }
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ message: "평점은 1~5 사이여야 합니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // 본인 통화 세션인지 확인
  const { data: session } = await admin
    .from("call_sessions")
    .select("id, consumer_id, creator_id, status")
    .eq("id", call_session_id)
    .single();

  if (!session) return NextResponse.json({ message: "통화 기록을 찾을 수 없습니다." }, { status: 404 });
  if (session.consumer_id !== authUser.id) {
    return NextResponse.json({ message: "본인의 통화만 평점을 남길 수 있습니다." }, { status: 403 });
  }
  if (session.status !== "ended") {
    return NextResponse.json({ message: "완료된 통화만 평점을 남길 수 있습니다." }, { status: 400 });
  }

  // 중복 평점 방지 (upsert)
  const { error } = await admin.from("creator_ratings").upsert(
    {
      call_session_id,
      consumer_id: authUser.id,
      creator_id,
      rating,
    },
    { onConflict: "call_session_id" }
  );

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  // avg_rating은 DB 트리거가 자동 업데이트
  return NextResponse.json({ success: true });
}
