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
    .select('consumer_id, creator_id, started_at, status, per_min_rate')
    .eq('id', sessionId)
    .single();

  if (!session) return NextResponse.json({ message: '세션을 찾을 수 없습니다.' }, { status: 404 });

  // 소비자 또는 크리에이터만 종료 가능
  if (session.consumer_id !== authUser.id && session.creator_id !== authUser.id) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }
  if (session.status !== 'active') {
    return NextResponse.json({ message: '이미 종료된 세션입니다.' }, { status: 409 });
  }

  const now = new Date();
  const startedAt = new Date(session.started_at);
  const durationSec = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
  const durationMin = Math.floor(durationSec / 60);
  const pointsCharged = durationMin * session.per_min_rate;

  // 소비자 포인트 차감 (최종 정산)
  const { data: consumer } = await admin
    .from('users')
    .select('points')
    .eq('id', session.consumer_id)
    .single();

  const finalDeduction = Math.min(pointsCharged, consumer?.points ?? 0);

  await admin
    .from('users')
    .update({ points: Math.max(0, (consumer?.points ?? 0) - finalDeduction) })
    .eq('id', session.consumer_id);

  // 크리에이터 수익 누적 (settlement_rate 조회)
  const { data: creator } = await admin
    .from('creators')
    .select('settlement_rate, monthly_minutes')
    .eq('id', session.creator_id)
    .single();

  const settlementRate = creator?.settlement_rate ?? 0.75;
  const creatorEarning = Math.floor(finalDeduction * settlementRate);

  await admin
    .from('creators')
    .update({ monthly_minutes: (creator?.monthly_minutes ?? 0) + durationMin })
    .eq('id', session.creator_id);

  // 세션 종료 처리
  await admin
    .from('call_sessions')
    .update({
      status: 'ended',
      ended_at: now.toISOString(),
      duration_sec: durationSec,
      points_charged: finalDeduction,
    })
    .eq('id', sessionId);

  return NextResponse.json({
    duration_sec: durationSec,
    points_charged: finalDeduction,
    creator_earning: creatorEarning,
  });
}
