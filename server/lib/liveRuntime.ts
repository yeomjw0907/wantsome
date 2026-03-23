export function mapLiveJoinError(errorCode: string | null | undefined) {
  switch (errorCode) {
    case "ROOM_NOT_FOUND":
      return { status: 404, message: "라이브를 찾을 수 없습니다." };
    case "ROOM_NOT_LIVE":
      return { status: 400, message: "입장할 수 없는 상태입니다." };
    case "CHANNEL_NOT_READY":
      return { status: 400, message: "방송 채널이 준비되지 않았습니다." };
    case "KICKED":
      return { status: 403, message: "강퇴된 라이브는 종료 전까지 다시 입장할 수 없습니다." };
    case "ROOM_FULL":
      return { status: 409, message: "정원이 마감되었습니다." };
    case "INSUFFICIENT_POINTS":
      return { status: 402, message: "포인트가 부족합니다." };
    default:
      return { status: 500, message: "라이브 입장 처리에 실패했습니다." };
  }
}

export function shouldRefundPendingAck(input: {
  role: string;
  status: string;
  refund_status: string;
  join_ack_at: string | null;
  joined_at: string | null;
  ackCutoffIso: string;
}) {
  if (input.role !== "viewer") return false;
  if (input.status !== "joined") return false;
  if (input.refund_status !== "none") return false;
  if (input.join_ack_at) return false;
  if (!input.joined_at) return false;

  return input.joined_at < input.ackCutoffIso;
}
