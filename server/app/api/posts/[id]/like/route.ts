/**
 * POST /api/posts/:id/like — 좋아요 토글
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

  const admin = createSupabaseAdmin();

  // 이미 좋아요 했는지 확인
  const { data: existing } = await admin
    .from("post_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", authUser.id)
    .maybeSingle();

  if (existing) {
    // 좋아요 취소
    await admin.from("post_likes").delete().eq("id", existing.id);
    await admin.rpc("decrement_post_like", { post_id: postId }).catch(() => {
      // fallback: 직접 업데이트
      admin.from("posts")
        .update({ like_count: admin.from("posts") as any })
        .eq("id", postId);
    });
    // 직접 카운트 업데이트
    const { data: post } = await admin.from("posts").select("like_count").eq("id", postId).single();
    if (post) {
      await admin.from("posts").update({ like_count: Math.max(0, (post.like_count ?? 1) - 1) }).eq("id", postId);
    }
    return NextResponse.json({ liked: false });
  } else {
    // 좋아요 추가
    await admin.from("post_likes").insert({ post_id: postId, user_id: authUser.id });
    const { data: post } = await admin.from("posts").select("like_count").eq("id", postId).single();
    if (post) {
      await admin.from("posts").update({ like_count: (post.like_count ?? 0) + 1 }).eq("id", postId);
    }
    return NextResponse.json({ liked: true });
  }
}
