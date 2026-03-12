/**
 * DELETE /api/posts/:id — 포스트 삭제 (소프트)
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient, createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!token) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user: authUser }, error: authErr } = await authClient.auth.getUser(token);
  if (authErr || !authUser) return NextResponse.json({ message: "Invalid token" }, { status: 401 });

  const admin = createSupabaseAdmin();

  const { data: post } = await admin
    .from("posts")
    .select("id, creator_id")
    .eq("id", id)
    .single();

  if (!post) return NextResponse.json({ message: "포스트를 찾을 수 없습니다." }, { status: 404 });
  if (post.creator_id !== authUser.id) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  await admin.from("posts").update({ is_deleted: true }).eq("id", id);

  return NextResponse.json({ success: true });
}
