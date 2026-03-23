import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAvailableReservationSlots,
  calcReservationDeposit,
  hasReservationConflict,
  isValidReservationDuration,
} from "@/lib/reservations";

function asLocalIso(dateTime: string) {
  return new Date(dateTime).toISOString();
}

function hasLocalTime(slots: { datetime: string }[], hour: number, minute: number) {
  return slots.some((slot) => {
    const date = new Date(slot.datetime);
    return date.getHours() === hour && date.getMinutes() === minute;
  });
}

test("reservation duration validation accepts only 10-60 in 5 minute steps", () => {
  assert.equal(isValidReservationDuration(10), true);
  assert.equal(isValidReservationDuration(15), true);
  assert.equal(isValidReservationDuration(60), true);
  assert.equal(isValidReservationDuration(9), false);
  assert.equal(isValidReservationDuration(12), false);
  assert.equal(isValidReservationDuration(65), false);
});

test("reservation deposit follows mode-based per-minute rate", () => {
  assert.equal(calcReservationDeposit(10, "blue"), 900);
  assert.equal(calcReservationDeposit(15, "red"), 1950);
  assert.equal(calcReservationDeposit(60, "blue"), 5400);
});

test("reservation overlap detects long booking collision correctly", () => {
  const reservations = [{ reserved_at: asLocalIso("2026-03-24T10:30:00"), duration_min: 60 }];

  assert.equal(
    hasReservationConflict(reservations, new Date("2026-03-24T10:20:00").getTime(), 60),
    true,
  );
  assert.equal(
    hasReservationConflict(reservations, new Date("2026-03-24T11:30:00").getTime(), 10),
    false,
  );
});

test("slot generation changes with selected duration and excludes overlapping starts", () => {
  const availability = [
    {
      day_of_week: 2,
      start_time: "10:00",
      end_time: "12:00",
      is_active: true,
    },
  ];
  const reservations = [{ reserved_at: asLocalIso("2026-03-24T10:30:00"), duration_min: 60 }];
  const fromDate = new Date("2026-03-24T00:00:00");
  const toDate = new Date("2026-03-24T23:59:59");
  const now = new Date("2026-03-24T06:00:00");

  const shortSlots = buildAvailableReservationSlots({
    availability,
    reservations,
    fromDate,
    toDate,
    durationMin: 10,
    now,
  }).filter((slot) => slot.available);

  const longSlots = buildAvailableReservationSlots({
    availability,
    reservations,
    fromDate,
    toDate,
    durationMin: 60,
    now,
  }).filter((slot) => slot.available);

  assert.ok(shortSlots.length > longSlots.length);
  assert.equal(hasLocalTime(longSlots, 10, 20), false);
  assert.equal(hasLocalTime(shortSlots, 11, 30), true);
});
