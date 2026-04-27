import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { verifyAdminSession } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const adminUser = await verifyAdminSession(req);
  if (!adminUser) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit  = 30;
  const filter = searchParams.get("filter") ?? "all"; // all | reported | deleted

  const admin = createSupabaseAdmin();

  let query = admin
    .from("posts")
    .select(`
      id, creator_id, caption, like_count, view_count, is_deleted, created_at,
      post_images(image_url, position),
      creators!inner(
        display_name,
        users!inner(nickname, profile_img)
      )
    `);

  if (filter === "deleted") {
    query = query.eq("is_deleted", true);
  } else if (filter === "reported") {
    // 신고된 포스트만
    const { data: reportedIds } = await admin
      .from("reports")
      .select("target_id")
      .eq("status", "PENDING")
      .not("target_id", "is", null);
    const ids = (reportedIds ?? []).map((r: any) => r.target_id);
    if (ids.length === 0) return NextResponse.json({ posts: [], hasMore: false });
    query = query.in("id", ids).eq("is_deleted", false);
  } else {
    query = query.eq("is_deleted", false);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  const posts = (data ?? []).map((r: any) => {
    const creator = r.creators ?? {};
    const user = creator.users ?? {};
    const images = (r.post_images ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((img: any) => img.image_url);
    return {
      id: r.id,
      creator_id: r.creator_id,
      creator_name: creator.display_name ?? user.nickname ?? "알 수 없음",
      creator_avatar: user.profile_img ?? null,
      caption: r.caption ?? "",
      images,
      like_count: r.like_count ?? 0,
      view_count: r.view_count ?? 0,
      is_deleted: r.is_deleted,
      created_at: r.created_at,
    };
  });

  return NextResponse.json({ posts, hasMore: posts.length >= limit });
}
