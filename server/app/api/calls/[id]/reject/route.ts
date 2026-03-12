import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient, createSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user: authUser }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id: sessionId } = await params;
  const admin = createSupabaseAdmin();

  const { data: session } = await admin
    .from('call_sessions')
    .select('consumer_id, creator_id, status')
    .eq('id', sessionId)
    .single();

  if (!session) return NextResponse.json({ message: '세션을 찾을 수 없습니다.' }, { status: 404 });
  if (session.creator_id !== authUser.id) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  if (session.status !== 'pending') {
    return NextResponse.json({ message: '이미 처리된 세션입니다.' }, { status: 409 });
  }

  await admin
    .from('call_sessions')
    .update({ status: 'rejected' })
    .eq('id', sessionId);

  // 소비자에게 call_rejected 신호
  await admin.from('call_signals').insert({
    session_id: sessionId,
    to_user_id: session.consumer_id,
    from_user_id: authUser.id,
    type: 'call_rejected',
    payload: {},
  });

  return NextResponse.json({ success: true });
}
