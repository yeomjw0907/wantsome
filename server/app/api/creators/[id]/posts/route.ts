/**
 * GET /api/creators/:id/posts — 크리에이터 포스트 목록 (그리드용)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: creatorId } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 18; // 3컬럼 × 6행

  const admin = createSupabaseAdmin();

  const { data: rows, error } = await admin
    .from("posts")
    .select(`
      id, like_count, created_at,
      post_images(image_url, position)
    `)
    .eq("creator_id", creatorId)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  const posts = (rows ?? []).map((r: any) => {
    const images = (r.post_images ?? [])
      .sort((a: any, b: any) => a.position - b.position);
    return {
      id:          r.id,
      thumbnail:   images[0]?.image_url ?? null,
      image_count: images.length,
      like_count:  r.like_count ?? 0,
      created_at:  r.created_at,
    };
  });

  return NextResponse.json({ posts, hasMore: posts.length >= limit });
}
