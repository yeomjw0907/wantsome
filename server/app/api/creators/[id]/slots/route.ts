/**
 * GET /api/creators/[id]/slots?from=YYYY-MM-DD&to=YYYY-MM-DD&duration_min=10
 *
 * 크리에이터 운영 시간대 안에서, 선택된 duration으로 실제 예약 가능한 시작 시각만 반환한다.
 * - 시작 시간 간격: 10분 단위
 * - 예약 시간: 10~60분, 5분 단위
 * - 최소 2시간 이후 슬롯만 노출
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Slot = {
  datetime: string;
  available: boolean;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const durationMin = Number(searchParams.get("duration_min"));

  if (!fromStr || !toStr || !Number.isFinite(durationMin)) {
    return NextResponse.json(
      { message: "from, to, duration_min 파라미터가 필요합니다" },
      { status: 400 }
    );
  }
  if (durationMin < 10 || durationMin > 60 || durationMin % 5 !== 0) {
    return NextResponse.json(
      { message: "duration_min은 10~60분 사이 5분 단위여야 합니다" },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdmin();
  const { data: availability } = await admin
    .from("creator_availability")
    .select("day_of_week, start_time, end_time, is_active")
    .eq("creator_id", id)
    .eq("is_active", true);

  if (!availability || availability.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  const availMap = new Map<number, { start_time: string; end_time: string }>();
  for (const row of availability) {
    availMap.set(row.day_of_week, {
      start_time: row.start_time,
      end_time: row.end_time,
    });
  }

  const slots: Slot[] = [];
  const fromDate = new Date(`${fromStr}T00:00:00`);
  const toDate = new Date(`${toStr}T23:59:59`);
  const now = new Date();
  const minBookingMs = 2 * 60 * 60 * 1000;
  const stepMs = 10 * 60 * 1000;
  const durationMs = durationMin * 60_000;

  const cur = new Date(fromDate);
  while (cur <= toDate) {
    const avail = availMap.get(cur.getDay());
    if (avail) {
      const [startH, startM] = avail.start_time.split(":").map(Number);
      const [endH, endM] = avail.end_time.split(":").map(Number);

      const windowStart = new Date(cur);
      windowStart.setHours(startH, startM, 0, 0);

      const windowEnd = new Date(cur);
      windowEnd.setHours(endH, endM, 0, 0);

      let t = new Date(windowStart);
      while (t.getTime() + durationMs <= windowEnd.getTime()) {
        slots.push({ datetime: t.toISOString(), available: true });
        t = new Date(t.getTime() + stepMs);
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  if (slots.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  const { data: reservations } = await admin
    .from("reservations")
    .select("reserved_at, duration_min")
    .eq("creator_id", id)
    .in("status", ["pending", "confirmed"])
    .gte("reserved_at", new Date(fromDate.getTime() - 60 * 60_000).toISOString())
    .lte("reserved_at", toDate.toISOString());

  const result = slots.map((slot) => {
    const slotStart = new Date(slot.datetime).getTime();
    const slotEnd = slotStart + durationMs;

    if (slotStart - now.getTime() < minBookingMs) {
      return { ...slot, available: false };
    }

    const overlaps = (reservations ?? []).some((res) => {
      const resStart = new Date(res.reserved_at).getTime();
      const resEnd = resStart + (res.duration_min ?? 30) * 60_000;
      return slotStart < resEnd && slotEnd > resStart;
    });

    return { ...slot, available: !overlaps };
  });

  return NextResponse.json({ slots: result });
}
