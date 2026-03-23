export type ConversationPostBodyLike = {
  creator_id?: string | null;
  consumer_id?: string | null;
  target_user_id?: string | null;
};

export type EndedCallSession = {
  consumer_id: string;
  creator_id: string;
  status: string;
};

export function getRequestedConversationTarget(body: ConversationPostBodyLike) {
  return body.target_user_id ?? body.consumer_id ?? body.creator_id ?? null;
}

export function resolvePostCallConversationParticipants(
  authUserId: string,
  session: EndedCallSession | null,
  requestedTargetId: string | null,
) {
  if (!session) {
    return { ok: false as const, status: 404, message: "Call session not found" };
  }

  if (session.status !== "ended") {
    return { ok: false as const, status: 400, message: "Only ended calls can open DMs" };
  }

  if (session.consumer_id !== authUserId && session.creator_id !== authUserId) {
    return { ok: false as const, status: 403, message: "Forbidden" };
  }

  const otherPartyId = session.consumer_id === authUserId ? session.creator_id : session.consumer_id;
  if (requestedTargetId && requestedTargetId !== otherPartyId) {
    return {
      ok: false as const,
      status: 403,
      message: "Target must be the other call participant",
    };
  }

  return {
    ok: true as const,
    creatorId: session.creator_id,
    consumerId: session.consumer_id,
    otherPartyId,
  };
}
