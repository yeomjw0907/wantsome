/**
 * POST /api/posts/:id/view — 조회수 증가
 */
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: postId } = await params;
  const admin = createSupabaseAdmin();

  // 현재 view_count 조회 후 +1
  const { data: post } = await admin
    .from('posts')
    .select('view_count')
    .eq('id', postId)
    .eq('is_deleted', false)
    .single();

  if (!post) return NextResponse.json({ ok: false }, { status: 404 });

  await admin
    .from('posts')
    .update({ view_count: (post.view_count ?? 0) + 1 })
    .eq('id', postId);

  return NextResponse.json({ ok: true });
}
