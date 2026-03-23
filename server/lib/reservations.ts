export const PER_MIN_RATE: Record<string, number> = {
  blue: 900,
  red: 1300,
};

export type ReservationInterval = {
  reserved_at: string;
  duration_min: number | null;
};

export type AvailabilityWindow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active?: boolean;
};

export type ReservationSlot = {
  datetime: string;
  available: boolean;
};

export function isValidReservationDuration(durationMin: number) {
  return Number.isFinite(durationMin) && durationMin >= 10 && durationMin <= 60 && durationMin % 5 === 0;
}

export function calcReservationDeposit(durationMin: number, mode: string): number {
  const rate = PER_MIN_RATE[mode] ?? PER_MIN_RATE.blue;
  return Math.round(durationMin * rate * 0.1);
}

export function buildReservationEndMs(startMs: number, durationMin: number | null | undefined) {
  return startMs + (durationMin ?? 30) * 60_000;
}

export function intervalsOverlap(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

export function hasReservationConflict(
  reservations: ReservationInterval[],
  slotStartMs: number,
  durationMin: number,
) {
  const slotEndMs = buildReservationEndMs(slotStartMs, durationMin);
  return reservations.some((reservation) => {
    const reservationStartMs = new Date(reservation.reserved_at).getTime();
    const reservationEndMs = buildReservationEndMs(reservationStartMs, reservation.duration_min);
    return intervalsOverlap(slotStartMs, slotEndMs, reservationStartMs, reservationEndMs);
  });
}

type BuildSlotsInput = {
  availability: AvailabilityWindow[];
  reservations: ReservationInterval[];
  fromDate: Date;
  toDate: Date;
  durationMin: number;
  now?: Date;
  minLeadHours?: number;
  stepMinutes?: number;
};

export function buildAvailableReservationSlots({
  availability,
  reservations,
  fromDate,
  toDate,
  durationMin,
  now = new Date(),
  minLeadHours = 2,
  stepMinutes = 10,
}: BuildSlotsInput): ReservationSlot[] {
  const availMap = new Map<number, { start_time: string; end_time: string }>();
  for (const row of availability) {
    if (row.is_active === false) continue;
    availMap.set(row.day_of_week, {
      start_time: row.start_time,
      end_time: row.end_time,
    });
  }

  const slots: ReservationSlot[] = [];
  const cursor = new Date(fromDate);
  const stepMs = stepMinutes * 60_000;
  const durationMs = durationMin * 60_000;
  const minLeadMs = minLeadHours * 60 * 60_000;

  while (cursor <= toDate) {
    const avail = availMap.get(cursor.getDay());
    if (avail) {
      const [startH, startM] = avail.start_time.split(":").map(Number);
      const [endH, endM] = avail.end_time.split(":").map(Number);

      const windowStart = new Date(cursor);
      windowStart.setHours(startH, startM, 0, 0);

      const windowEnd = new Date(cursor);
      windowEnd.setHours(endH, endM, 0, 0);

      for (
        let slotStartMs = windowStart.getTime();
        slotStartMs + durationMs <= windowEnd.getTime();
        slotStartMs += stepMs
      ) {
        const available =
          slotStartMs - now.getTime() >= minLeadMs &&
          !hasReservationConflict(reservations, slotStartMs, durationMin);

        slots.push({
          datetime: new Date(slotStartMs).toISOString(),
          available,
        });
      }
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return slots;
}
