import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient, createSupabaseAdmin } from '@/lib/supabase';
import { generateAgoraToken, AGORA_CREATOR_UID } from '@/lib/agora';

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
    .select('consumer_id, creator_id, agora_channel, status, per_min_rate')
    .eq('id', sessionId)
    .single();

  if (!session) return NextResponse.json({ message: '세션을 찾을 수 없습니다.' }, { status: 404 });
  if (session.creator_id !== authUser.id) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  if (session.status !== 'pending') {
    return NextResponse.json({ message: '이미 처리된 세션입니다.' }, { status: 409 });
  }

  // 크리에이터 토큰 생성
  const agoraToken = generateAgoraToken(session.agora_channel, AGORA_CREATOR_UID);
  const now = new Date().toISOString();

  // 세션 상태 업데이트
  await admin
    .from('call_sessions')
    .update({ status: 'active', started_at: now })
    .eq('id', sessionId);

  // 소비자에게 call_accepted 신호
  await admin.from('call_signals').insert({
    session_id: sessionId,
    to_user_id: session.consumer_id,
    from_user_id: authUser.id,
    type: 'call_accepted',
    payload: {
      agora_channel: session.agora_channel,
    },
  });

  return NextResponse.json({
    agora_channel: session.agora_channel,
    agora_token: agoraToken,
  });
}
