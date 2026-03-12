import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Vercel Cron 보호
  const cronSecret = req.headers.get('authorization');
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createSupabaseAdmin();

  // 진행 중인 세션 전체 조회
  const { data: sessions, error } = await admin
    .from('call_sessions')
    .select('id, consumer_id, creator_id, per_min_rate, started_at')
    .eq('status', 'active');

  if (error) {
    console.error('tick: sessions query error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  let processed = 0;
  let autoEnded = 0;

  for (const session of sessions) {
    const { data: consumer } = await admin
      .from('users')
      .select('points')
      .eq('id', session.consumer_id)
      .single();

    if (!consumer) continue;
    const remaining = consumer.points - session.per_min_rate;

    if (remaining < 0) {
      // 포인트 소진 → 강제 종료 (end 로직 인라인)
      const now = new Date();
      const startedAt = new Date(session.started_at);
      const durationSec = Math.floor((now.getTime() - startedAt.getTime()) / 1000);
      const durationMin = Math.floor(durationSec / 60);
      const pointsCharged = Math.min(durationMin * session.per_min_rate, consumer.points);

      await admin.from('users').update({ points: 0 }).eq('id', session.consumer_id);

      const { data: creator } = await admin
        .from('creators')
        .select('settlement_rate, monthly_minutes')
        .eq('id', session.creator_id)
        .single();

      await admin
        .from('creators')
        .update({ monthly_minutes: (creator?.monthly_minutes ?? 0) + durationMin })
        .eq('id', session.creator_id);

      await admin
        .from('call_sessions')
        .update({ status: 'ended', ended_at: now.toISOString(), duration_sec: durationSec, points_charged: pointsCharged })
        .eq('id', session.id);

      // 강제 종료 신호 (양쪽 모두)
      await admin.from('call_signals').insert([
        { session_id: session.id, to_user_id: session.consumer_id, from_user_id: session.creator_id, type: 'call_ended', payload: { reason: 'points_exhausted' } },
        { session_id: session.id, to_user_id: session.creator_id, from_user_id: session.consumer_id, type: 'call_ended', payload: { reason: 'points_exhausted' } },
      ]);
      autoEnded++;
    } else {
      // 포인트 차감
      await admin.from('users').update({ points: remaining }).eq('id', session.consumer_id);
      processed++;
    }
  }

  return NextResponse.json({ processed, autoEnded });
}
