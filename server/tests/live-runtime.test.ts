import assert from "node:assert/strict";
import test from "node:test";
import { mapLiveJoinError, shouldRefundPendingAck } from "../lib/liveRuntime";

test("live join errors map to stable API responses", () => {
  assert.deepEqual(mapLiveJoinError("ROOM_FULL"), {
    status: 409,
    message: "정원이 마감되었습니다.",
  });
  assert.equal(mapLiveJoinError("KICKED").status, 403);
});

test("refund predicate only matches stale unacked viewer joins", () => {
  assert.equal(
    shouldRefundPendingAck({
      role: "viewer",
      status: "joined",
      refund_status: "none",
      join_ack_at: null,
      joined_at: "2026-03-24T10:00:00.000Z",
      ackCutoffIso: "2026-03-24T10:00:10.000Z",
    }),
    true,
  );

  assert.equal(
    shouldRefundPendingAck({
      role: "viewer",
      status: "joined",
      refund_status: "none",
      join_ack_at: "2026-03-24T10:00:05.000Z",
      joined_at: "2026-03-24T10:00:00.000Z",
      ackCutoffIso: "2026-03-24T10:00:10.000Z",
    }),
    false,
  );
});
