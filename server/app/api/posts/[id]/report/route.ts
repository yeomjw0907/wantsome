/**
 * POST /api/posts/:id/report — 포스트 신고
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const body = await req.json();
  const { category, description } = body as {
    category: "OBSCENE" | "ILLEGAL" | "SPAM" | "UNDERAGE" | "OTHER";
    description?: string;
  };

  const admin = createSupabaseAdmin();

  // 포스트 + 크리에이터 확인
  const { data: post } = await admin
    .from("posts")
    .select("id, creator_id")
    .eq("id", postId)
    .single();

  if (!post) return NextResponse.json({ message: "포스트를 찾을 수 없습니다." }, { status: 404 });

  // reports 테이블에 신고 기록 (기존 reports 테이블 활용)
  await admin.from("reports").insert({
    reporter_id:  authUser.id,
    target_id:    post.creator_id,
    category:     category ?? "OTHER",
    description:  description ? `[포스트 신고: ${postId}] ${description}` : `[포스트 신고: ${postId}]`,
  });

  // 성기 노출 / 미성년 등 심각한 경우 포스트 즉시 숨김
  if (["OBSCENE", "ILLEGAL", "UNDERAGE"].includes(category)) {
    await admin.from("posts").update({ is_deleted: true }).eq("id", postId);
  }

  return NextResponse.json({ success: true });
}
