/**
 * GET /api/creators/[id]/slots?from=YYYY-MM-DD&to=YYYY-MM-DD
 *
 * 크리에이터의 예약 가능 시간 슬롯 목록 반환 (공개 API)
 *
 * 알고리즘:
 * 1. creator_availability (요일별 가용시간) 조회
 * 2. from~to 날짜 순회 → 요일별로 30분 단위 슬롯 생성
 * 3. 해당 기간 pending/confirmed 예약 조회
 * 4. 겹치는 슬롯 제거
 * 5. 현재 시간 기준 2시간 이후 슬롯만 노출
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Slot = {
  datetime: string; // ISO 8601, KST 기준 local datetime (e.g. "2026-03-18T20:00:00")
  available: boolean;
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from"); // YYYY-MM-DD
  const toStr = searchParams.get("to");     // YYYY-MM-DD

  if (!fromStr || !toStr) {
    return NextResponse.json({ message: "from, to 파라미터가 필요합니다." }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  // 1. 가용시간 조회
  const { data: availability } = await admin
    .from("creator_availability")
    .select("day_of_week, start_time, end_time, slot_duration_min, is_active")
    .eq("creator_id", id)
    .eq("is_active", true);

  if (!availability || availability.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  // 요일별 가용시간 맵
  const availMap = new Map<number, { start_time: string; end_time: string; slot_duration_min: number }>();
  for (const a of availability) {
    availMap.set(a.day_of_week, {
      start_time: a.start_time,
      end_time: a.end_time,
      slot_duration_min: a.slot_duration_min ?? 30,
    });
  }

  // 2. 기간 내 날짜 순회 → 슬롯 생성 (로컬 시각 기준)
  const slots: Slot[] = [];
  const fromDate = new Date(fromStr + "T00:00:00");
  const toDate = new Date(toStr + "T23:59:59");
  const now = new Date();
  const minBookingMs = 2 * 60 * 60 * 1000; // 2시간 후부터 예약 가능

  const cur = new Date(fromDate);
  while (cur <= toDate) {
    const dow = cur.getDay(); // 0=일~6=토
    const avail = availMap.get(dow);
    if (avail) {
      const [startH, startM] = avail.start_time.split(":").map(Number);
      const [endH, endM] = avail.end_time.split(":").map(Number);
      const slotMin = avail.slot_duration_min;

      const slotStart = new Date(cur);
      slotStart.setHours(startH, startM, 0, 0);
      const slotEnd = new Date(cur);
      slotEnd.setHours(endH, endM, 0, 0);

      let t = new Date(slotStart);
      while (t < slotEnd) {
        const dt = t.toISOString().slice(0, 16).replace("T", "T"); // ISO local
        slots.push({ datetime: t.toISOString(), available: true });
        t = new Date(t.getTime() + slotMin * 60 * 1000);
      }
    }
    cur.setDate(cur.getDate() + 1);
  }

  if (slots.length === 0) {
    return NextResponse.json({ slots: [] });
  }

  // 3. 해당 기간 예약 조회 (pending/confirmed)
  const { data: reservations } = await admin
    .from("reservations")
    .select("reserved_at, duration_min")
    .eq("creator_id", id)
    .in("status", ["pending", "confirmed"])
    .gte("reserved_at", fromDate.toISOString())
    .lte("reserved_at", toDate.toISOString());

  // 4. 겹침 체크 + 2시간 리드타임 필터
  const result = slots.map((slot) => {
    const slotMs = new Date(slot.datetime).getTime();
    const slotDurationMs = 30 * 60 * 1000; // 최소 슬롯 단위 30분

    // 2시간 이내 슬롯 불가
    if (slotMs - now.getTime() < minBookingMs) {
      return { ...slot, available: false };
    }

    // 기존 예약과 겹침 확인
    const overlaps = (reservations ?? []).some((res) => {
      const resStart = new Date(res.reserved_at).getTime();
      const resEnd = resStart + res.duration_min * 60 * 1000;
      const slotEnd = slotMs + slotDurationMs;
      return resStart < slotEnd && resEnd > slotMs;
    });

    return { ...slot, available: !overlaps };
  });

  return NextResponse.json({ slots: result });
}
