import test from "node:test";
import assert from "node:assert/strict";
import {
  getRequestedConversationTarget,
  resolvePostCallConversationParticipants,
} from "@/lib/conversations";

test("requested conversation target prefers explicit target_user_id", () => {
  assert.equal(
    getRequestedConversationTarget({
      target_user_id: "user-b",
      creator_id: "creator-a",
      consumer_id: "user-a",
    }),
    "user-b",
  );
});

test("post-call dm resolution allows consumer to open DM to creator", () => {
  const result = resolvePostCallConversationParticipants(
    "consumer-1",
    {
      consumer_id: "consumer-1",
      creator_id: "creator-1",
      status: "ended",
    },
    "creator-1",
  );

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.creatorId, "creator-1");
    assert.equal(result.consumerId, "consumer-1");
    assert.equal(result.otherPartyId, "creator-1");
  }
});

test("post-call dm resolution rejects mismatched target", () => {
  const result = resolvePostCallConversationParticipants(
    "creator-1",
    {
      consumer_id: "consumer-1",
      creator_id: "creator-1",
      status: "ended",
    },
    "stranger",
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 403);
  }
});

test("post-call dm resolution rejects non-ended calls", () => {
  const result = resolvePostCallConversationParticipants(
    "consumer-1",
    {
      consumer_id: "consumer-1",
      creator_id: "creator-1",
      status: "active",
    },
    "creator-1",
  );

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
  }
});
