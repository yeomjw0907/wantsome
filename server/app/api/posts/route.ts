/**
 * GET  /api/posts/feed  — 전체 피드 (최신순)
 * POST /api/posts       — 포스트 생성 (크리에이터 전용)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(30, Math.max(1, parseInt(searchParams.get("limit") ?? String(PAGE_SIZE), 10)));

  const admin = createSupabaseAdmin();

  const { data: rows, error } = await admin
    .from("posts")
    .select(`
      id, creator_id, caption, like_count, created_at,
      post_images(id, image_url, position),
      creators!inner(
        id, display_name, avg_rating,
        users!inner(profile_img, is_verified)
      )
    `)
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (error) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }

  // 현재 유저가 좋아요한 포스트 목록
  const postIds = (rows ?? []).map((r: any) => r.id);
  let likedSet = new Set<string>();
  if (postIds.length > 0) {
    const { data: likes } = await admin
      .from("post_likes")
      .select("post_id")
      .eq("user_id", authUser.id)
      .in("post_id", postIds);
    likedSet = new Set((likes ?? []).map((l: any) => l.post_id));
  }

  const posts = (rows ?? []).map((r: any) => {
    const creator = r.creators ?? {};
    const user    = creator.users ?? {};
    const images  = (r.post_images ?? [])
      .sort((a: any, b: any) => a.position - b.position)
      .map((img: any) => img.image_url);

    return {
      id:           r.id,
      creator_id:   r.creator_id,
      creator_name: creator.display_name ?? "크리에이터",
      creator_avatar: user.profile_img ?? null,
      creator_verified: user.is_verified ?? false,
      caption:      r.caption ?? "",
      images,
      like_count:   r.like_count ?? 0,
      is_liked:     likedSet.has(r.id),
      created_at:   r.created_at,
    };
  });

  return NextResponse.json({ posts, hasMore: posts.length >= limit });
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();

  // 크리에이터 확인
  const { data: creator } = await admin
    .from("creators")
    .select("id")
    .eq("id", authUser.id)
    .single();
  if (!creator) return NextResponse.json({ message: "크리에이터만 포스트를 작성할 수 있습니다." }, { status: 403 });

  const body = await req.json();
  const { caption, images } = body as { caption?: string; images: string[] };

  if (!images || images.length === 0) {
    return NextResponse.json({ message: "이미지를 최소 1장 업로드해주세요." }, { status: 400 });
  }
  if (images.length > 3) {
    return NextResponse.json({ message: "이미지는 최대 3장까지 업로드할 수 있습니다." }, { status: 400 });
  }

  // 포스트 생성
  const { data: post, error: postErr } = await admin
    .from("posts")
    .insert({ creator_id: creator.id, caption: caption?.trim() ?? null })
    .select("id")
    .single();

  if (postErr || !post) {
    return NextResponse.json({ message: "포스트 생성에 실패했습니다." }, { status: 500 });
  }

  // 이미지 연결
  const imageRows = images.map((url, idx) => ({
    post_id: post.id,
    image_url: url,
    position: idx,
  }));
  await admin.from("post_images").insert(imageRows);

  return NextResponse.json({ post_id: post.id }, { status: 201 });
}
