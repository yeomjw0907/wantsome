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
import {
  buildAvailableReservationSlots,
  isValidReservationDuration,
} from "@/lib/reservations";

export const dynamic = "force-dynamic";

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
  if (!isValidReservationDuration(durationMin)) {
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

  const fromDate = new Date(`${fromStr}T00:00:00`);
  const toDate = new Date(`${toStr}T23:59:59`);
  const { data: reservations } = await admin
    .from("reservations")
    .select("reserved_at, duration_min")
    .eq("creator_id", id)
    .in("status", ["pending", "confirmed"])
    .gte("reserved_at", new Date(fromDate.getTime() - 60 * 60_000).toISOString())
    .lte("reserved_at", toDate.toISOString());

  const result = buildAvailableReservationSlots({
    availability: availability ?? [],
    reservations: reservations ?? [],
    fromDate,
    toDate,
    durationMin,
  });

  return NextResponse.json({ slots: result });
}
