import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseClient, createSupabaseAdmin } from '@/lib/supabase';
import { generateAgoraToken, AGORA_CONSUMER_UID } from '@/lib/agora';

export const dynamic = 'force-dynamic';

const PER_MIN_RATES: Record<string, number> = { blue: 900, red: 1300 };

export async function POST(req: NextRequest) {
  // 1. 인증
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  if (!token) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const authClient = createSupabaseClient(token);
  const { data: { user: authUser }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authUser) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  // 2. 요청 파라미터
  let creator_id: string, mode: string;
  try {
    const body = await req.json();
    creator_id = body.creator_id;
    mode = body.mode;
  } catch {
    return NextResponse.json({ message: '요청 형식이 잘못됐습니다.' }, { status: 400 });
  }

  if (!creator_id || !['blue', 'red'].includes(mode)) {
    return NextResponse.json({ message: '필수 파라미터가 없습니다.' }, { status: 400 });
  }

  const admin = createSupabaseAdmin();
  const perMinRate = PER_MIN_RATES[mode];

  // 3. 소비자 포인트 확인
  const { data: consumer } = await admin
    .from('users')
    .select('points, nickname, profile_img')
    .eq('id', authUser.id)
    .single();

  if (!consumer || consumer.points < perMinRate) {
    return NextResponse.json(
      { message: '포인트가 부족합니다. 충전 후 이용해주세요.' },
      { status: 402 },
    );
  }

  // 4. 크리에이터 온라인 상태 확인
  const { data: creator } = await admin
    .from('creators')
    .select('is_online, display_name')
    .eq('id', creator_id)
    .single();

  if (!creator) {
    return NextResponse.json({ message: '크리에이터를 찾을 수 없습니다.' }, { status: 404 });
  }
  if (!creator.is_online) {
    return NextResponse.json({ message: '크리에이터가 오프라인 상태입니다.' }, { status: 409 });
  }

  // 5. 세션 생성
  const sessionId = crypto.randomUUID();
  const agoraChannel = `wantsome-${sessionId}`;
  const agoraToken = generateAgoraToken(agoraChannel, AGORA_CONSUMER_UID);

  const { error: insertError } = await admin.from('call_sessions').insert({
    id: sessionId,
    consumer_id: authUser.id,
    creator_id,
    agora_channel: agoraChannel,
    mode,
    status: 'pending',
    per_min_rate: perMinRate,
  });

  if (insertError) {
    console.error('call_sessions insert error:', insertError);
    return NextResponse.json({ message: '통화 세션 생성에 실패했습니다.' }, { status: 500 });
  }

  // 6. 크리에이터에게 incoming_call 신호 삽입
  await admin.from('call_signals').insert({
    session_id: sessionId,
    to_user_id: creator_id,
    from_user_id: authUser.id,
    type: 'incoming_call',
    payload: {
      consumer_nickname: consumer.nickname,
      consumer_avatar: consumer.profile_img ?? null,
      mode,
      per_min_rate: perMinRate,
    },
  });

  return NextResponse.json({
    session_id: sessionId,
    agora_channel: agoraChannel,
    agora_token: agoraToken,
    per_min_rate: perMinRate,
    creator_name: creator.display_name,
  });
}
